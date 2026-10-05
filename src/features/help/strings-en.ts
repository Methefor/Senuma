/**
 * Help, feedback and review-request strings, English: the source of truth for their keys.
 *
 * These live beside the feature, not in i18n/en.ts, because the feature loads on demand and its
 * words should too (the startup bundle has no room to spare). Every other language is a file of
 * the same shape, strings-<lang>.ts, checked against this one by the compiler and a test.
 */
export const HELP_EN = {
    'section.help': 'Help',
    'section.feedback': 'Feedback',
    'help.intro': 'The user guide comes with Senuma: it opens in a new tab and works offline.',
    'help.guide': 'User Guide',
    'help.guideHint': 'Everything Senuma does, step by step.',
    'help.start': 'Getting Started',
    'help.startHint': 'Your first Spaces, your look and bringing in your links.',
    'help.keys': 'Keyboard Shortcuts',
    'help.keysHint': 'Every shortcut, at a glance.',
    'help.privacy': 'Privacy & Permissions',
    'help.privacyHint': 'What stays on your device, and why a permission is asked.',
    'help.backup': 'Import & Backup',
    'help.backupHint': 'Backup files, restore points and importing links.',
    'help.about': 'About Senuma',
    'help.aboutHint': 'Version and what Senuma is.',
    'help.newTab': '(opens in a new tab)',

    'feedback.problem': 'Report a problem',
    'feedback.problemHint': 'For things that do not work correctly.',
    'feedback.idea': 'Suggest an idea',
    'feedback.ideaHint': 'For features or improvements.',
    'feedback.general': 'Share feedback',
    'feedback.generalHint': 'For general comments about Senuma.',
    'feedback.describe.problem': 'What went wrong?',
    'feedback.describe.idea': 'What would you like Senuma to do?',
    'feedback.describe.general': 'Your feedback',
    'feedback.steps': 'Steps to reproduce (optional)',
    'feedback.tech': 'Include technical details',
    'feedback.techHint': 'Only the lines shown in the message below. Nothing about your Spaces, links or browsing.',
    'feedback.preview': 'Your email app will open with this message:',
    'feedback.email': 'Open in email app',
    'feedback.copy': 'Copy message',
    'feedback.copied': 'Message copied',
    'feedback.address': 'If no email app opens, copy the message and send it to {email}',
    'feedback.private': 'Senuma sends nothing by itself. Your email app opens with this message; you can change it, and you decide whether to send it.',

    'report.type': 'Type',
    'report.version': 'Senuma version',
    'report.browser': 'Browser',
    'report.os': 'Operating system',
    'report.language': 'Interface language',
    'report.description': 'Description',
    'report.steps': 'Steps to reproduce',
    'report.tech': 'Technical details',
    'report.subject.problem': 'Problem report',
    'report.subject.idea': 'Idea',
    'report.subject.general': 'Feedback',

    'learn.shortcuts': 'Learn more about search shortcuts',
    'learn.background': 'Learn about Fill, Fit, Position, Blur and Atmosphere',
    'learn.closedTabs': 'Why does Senuma need this permission?',
    'learn.backup': 'How backups and restore points work',

    'review.label': 'A request for a review',
    'review.title': 'Enjoying Senuma?',
    'review.body': 'A short Chrome Web Store review helps Senuma grow.',
    'review.rate': 'Leave a review',
    'review.feedback': 'Send feedback',
    'review.later': 'Not now',
} as const;

export type HelpKey = keyof typeof HELP_EN;
export type HelpStrings = Record<HelpKey, string>;
