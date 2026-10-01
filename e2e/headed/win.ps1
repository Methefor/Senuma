# Windows helpers for the headed Chrome pass. Acts only on the Chrome that was started with the
# given throw-away profile folder; never on any other window.
#
#   win.ps1 -Profile <dir> -Action buttons            list native buttons/dialog text in that Chrome
#   win.ps1 -Profile <dir> -Action invoke -Name Allow press a native button whose name matches
#   win.ps1 -Profile <dir> -Action click -Name "x,y"   real mouse click at a point inside that window (0..1)
#   win.ps1 -Profile <dir> -Action keys -Keys "^t"    send keys, only if that Chrome is in front
#   win.ps1 -Profile <dir> -Action focus              report what has keyboard focus in that Chrome
#   win.ps1 -Profile <dir> -Action shot -Out <png>    screenshot of that Chrome window only
param([string]$Profile, [string]$Action, [string]$Name, [string]$Keys, [string]$Out)

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Add-Type -AssemblyName UIAutomationClient, UIAutomationTypes, System.Windows.Forms, System.Drawing
Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class Win {
    [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
    [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT rect);
    [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint pid);
    [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int cmd);
    [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
    [DllImport("user32.dll")] public static extern bool GetCursorPos(out POINT point);
    [DllImport("user32.dll")] public static extern void mouse_event(uint flags, uint dx, uint dy, uint data, UIntPtr extra);
    public struct RECT { public int Left, Top, Right, Bottom; }
    public struct POINT { public int X, Y; }
    [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
    [DllImport("user32.dll")] public static extern void keybd_event(byte key, byte scan, uint flags, UIntPtr extra);
    [DllImport("kernel32.dll")] public static extern uint GetCurrentThreadId();
    [DllImport("user32.dll")] public static extern bool AttachThreadInput(uint from, uint to, bool attach);
    [DllImport("user32.dll")] public static extern bool BringWindowToTop(IntPtr hWnd);
    // Brings the window to the front without pressing any key (a key press would itself move focus).
    public static void Front(IntPtr hWnd, uint pid) {
        IntPtr front = GetForegroundWindow();
        uint frontPid; uint frontThread = GetWindowThreadProcessId(front, out frontPid);
        if (frontPid == pid) return;
        uint me = GetCurrentThreadId();
        AttachThreadInput(me, frontThread, true);
        ShowWindow(hWnd, 9); BringWindowToTop(hWnd); SetForegroundWindow(hWnd);
        AttachThreadInput(me, frontThread, false);
    }
}
'@
[Win]::SetProcessDPIAware() | Out-Null

$needle = [IO.Path]::GetFileName($Profile.TrimEnd('\', '/'))
$main = Get-CimInstance Win32_Process -Filter "name='chrome.exe'" |
    Where-Object { $_.CommandLine -like "*$needle*" -and $_.CommandLine -notlike '*--type=*' } | Select-Object -First 1
if (-not $main) { Write-Output 'NO-CHROME'; exit 2 }
$chromePid = [int]$main.ProcessId

$root = [System.Windows.Automation.AutomationElement]::RootElement
$pidCondition = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::ProcessIdProperty, $chromePid)
$windows = $root.FindAll([System.Windows.Automation.TreeScope]::Children, $pidCondition)
if ($windows.Count -eq 0) { Write-Output 'NO-WINDOW'; exit 2 }
$mainWindow = $windows | Where-Object { $_.Current.ClassName -eq 'Chrome_WidgetWin_1' -and $_.Current.Name } | Select-Object -First 1
if (-not $mainWindow) { $mainWindow = $windows[0] }
$hwnd = [IntPtr]$mainWindow.Current.NativeWindowHandle

function Find-Elements($type) {
    $condition = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::ControlTypeProperty, $type)
    $found = @()
    foreach ($window in $windows) { $found += $window.FindAll([System.Windows.Automation.TreeScope]::Descendants, $condition) }
    return $found
}

switch ($Action) {
    'buttons' {
        Write-Output ("WINDOWS: " + (($windows | ForEach-Object { $_.Current.ClassName + '|' + $_.Current.Name }) -join ' ;; '))
        $names = Find-Elements ([System.Windows.Automation.ControlType]::Button) | ForEach-Object { $_.Current.Name } | Where-Object { $_ }
        Write-Output ("BUTTONS: " + ($names -join ' | '))
        $dialogs = @()
        foreach ($type in @([System.Windows.Automation.ControlType]::Window, [System.Windows.Automation.ControlType]::Pane, [System.Windows.Automation.ControlType]::Custom)) {
            $dialogs += Find-Elements $type | Where-Object { $_.Current.Name -match 'permission|wants|Add|bookmark|history|Read' } | ForEach-Object { $_.Current.Name }
        }
        Write-Output ("DIALOGS: " + (($dialogs | Select-Object -Unique) -join ' | '))
        $texts = Find-Elements ([System.Windows.Automation.ControlType]::Text) | ForEach-Object { $_.Current.Name } | Where-Object { $_ -match 'bookmark|history|Read|wants|permission' }
        Write-Output ("TEXT: " + (($texts | Select-Object -Unique) -join ' | '))
    }
    'prompt' {
        # The native dialog that holds a button matching -Name: its title, its texts, its buttons.
        $button = Find-Elements ([System.Windows.Automation.ControlType]::Button) | Where-Object { $_.Current.Name -match $Name } | Select-Object -First 1
        if (-not $button) { Write-Output 'NO-PROMPT'; exit 0 }
        $walker = [System.Windows.Automation.TreeWalker]::ControlViewWalker
        $box = $button
        for ($i = 0; $i -lt 6; $i++) {
            $parent = $walker.GetParent($box)
            if (-not $parent -or $parent.Current.ClassName -eq 'BrowserView' -or $parent.Current.ClassName -eq 'Chrome_WidgetWin_1' -and $parent.Current.Name -match 'Chrome$') { break }
            $box = $parent
            if ($box.Current.ControlType -eq [System.Windows.Automation.ControlType]::Window) { break }
        }
        $all = $box.FindAll([System.Windows.Automation.TreeScope]::Subtree, [System.Windows.Automation.Condition]::TrueCondition)
        $texts = $all | Where-Object { $_.Current.ControlType -eq [System.Windows.Automation.ControlType]::Text } | ForEach-Object { $_.Current.Name } | Where-Object { $_ } | Select-Object -Unique
        $buttons = $all | Where-Object { $_.Current.ControlType -eq [System.Windows.Automation.ControlType]::Button } | ForEach-Object { $_.Current.Name } | Where-Object { $_ }
        Write-Output ("PROMPT: " + $box.Current.Name + " || " + ($texts -join ' / ') + " || buttons: " + ($buttons -join ', '))
    }
    'invoke' {
        $button = Find-Elements ([System.Windows.Automation.ControlType]::Button) | Where-Object { $_.Current.Name -match $Name } | Select-Object -First 1
        if (-not $button) { Write-Output "NO-BUTTON $Name"; exit 3 }
        $pressed = $button.Current.Name
        $button.GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern).Invoke()
        Write-Output "INVOKED $pressed"
    }
    'keys' {
        [Win]::Front($hwnd, [uint32]$chromePid)
        Start-Sleep -Milliseconds 400
        $front = [Win]::GetForegroundWindow()
        $frontPid = 0
        [Win]::GetWindowThreadProcessId($front, [ref]$frontPid) | Out-Null
        if ($frontPid -ne $chromePid) { Write-Output "NOT-IN-FRONT (front pid $frontPid)"; exit 4 }
        [System.Windows.Forms.SendKeys]::SendWait($Keys)
        Write-Output "SENT $Keys"
    }
    'click' {
        [Win]::Front($hwnd, [uint32]$chromePid)
        Start-Sleep -Milliseconds 400
        $front = [Win]::GetForegroundWindow()
        $frontPid = 0
        [Win]::GetWindowThreadProcessId($front, [ref]$frontPid) | Out-Null
        if ($frontPid -ne $chromePid) { Write-Output "NOT-IN-FRONT (front pid $frontPid)"; exit 4 }
        $rect = New-Object Win+RECT
        [Win]::GetWindowRect($hwnd, [ref]$rect) | Out-Null
        $parts = $Name.Split(',')
        $x = [int]($rect.Left + ($rect.Right - $rect.Left) * [double]::Parse($parts[0], [Globalization.CultureInfo]::InvariantCulture))
        $y = [int]($rect.Top + ($rect.Bottom - $rect.Top) * [double]::Parse($parts[1], [Globalization.CultureInfo]::InvariantCulture))
        $before = New-Object Win+POINT
        [Win]::GetCursorPos([ref]$before) | Out-Null
        [Win]::SetCursorPos($x, $y) | Out-Null
        [Win]::mouse_event(2, 0, 0, 0, [UIntPtr]::Zero); [Win]::mouse_event(4, 0, 0, 0, [UIntPtr]::Zero)
        Start-Sleep -Milliseconds 150
        [Win]::SetCursorPos($before.X, $before.Y) | Out-Null
        Write-Output "CLICKED $x,$y"
    }
    'focus' {
        $focused = [System.Windows.Automation.AutomationElement]::FocusedElement
        if ($focused.Current.ProcessId -ne $chromePid) { Write-Output "FOCUS-ELSEWHERE"; exit 0 }
        Write-Output ("FOCUS: " + $focused.Current.ControlType.ProgrammaticName + ' | ' + $focused.Current.Name + ' | ' + $focused.Current.ClassName)
    }
    'shot' {
        $rect = New-Object Win+RECT
        [Win]::GetWindowRect($hwnd, [ref]$rect) | Out-Null
        $width = $rect.Right - $rect.Left; $height = $rect.Bottom - $rect.Top
        $bitmap = New-Object System.Drawing.Bitmap($width, $height)
        $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
        $graphics.CopyFromScreen($rect.Left, $rect.Top, 0, 0, $bitmap.Size)
        $bitmap.Save($Out, [System.Drawing.Imaging.ImageFormat]::Png)
        Write-Output "SHOT $Out ${width}x${height}"
    }
}
