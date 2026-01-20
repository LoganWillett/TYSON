// Built-in "program plugin" templates.
// These are not strict programs; they're coherent pattern sequences that TYSON fills with exercises
// based on the user's equipment and priority focus.

export const BUILTIN_PLUGINS = [
  {
    id: 'fb_strength',
    name: 'Full Body Strength (3x)',
    note: 'Great default for beginners and busy schedules. Focuses on squat/hinge/push/pull/core each day.',
    templateForDays: (days) => ({
      name: 'Full Body Strength',
      days: [
        { name: 'Full Body 1', patterns: ['squat','push','pull','hinge','core'] },
        { name: 'Full Body 2', patterns: ['squat','pull','push','lunge','core'] },
        { name: 'Full Body 3', patterns: ['hinge','push','pull','isolation','core'] },
      ].slice(0, days),
    }),
  },
  {
    id: 'ul_4',
    name: 'Upper/Lower (4x)',
    note: 'Balanced strength + muscle. Two upper and two lower days; easy progression.',
    templateForDays: (days) => ({
      name: 'Upper/Lower',
      days: [
        { name: 'Upper 1', patterns: ['push','pull','push','pull','isolation'] },
        { name: 'Lower 1', patterns: ['squat','hinge','lunge','core','carry'] },
        { name: 'Upper 2', patterns: ['push','pull','push','pull','isolation'] },
        { name: 'Lower 2', patterns: ['squat','hinge','lunge','core','carry'] },
      ].slice(0, days),
    }),
  },
  {
    id: 'ppl_hyp',
    name: 'PPL Hypertrophy (5–6x)',
    note: 'Higher volume. Works well when you can train most days and recover well.',
    templateForDays: (days) => ({
      name: 'PPL / Hypertrophy',
      days: [
        { name: 'Push', patterns: ['push','push','isolation','core'] },
        { name: 'Pull', patterns: ['pull','pull','isolation','core'] },
        { name: 'Legs', patterns: ['squat','hinge','lunge','core','carry'] },
        { name: 'Upper', patterns: ['push','pull','push','pull','isolation'] },
        { name: 'Lower', patterns: ['squat','hinge','lunge','core','carry'] },
        { name: 'Prehab', patterns: ['prehab','isolation','core','carry'] },
      ].slice(0, days),
    }),
  },
  {
    id: 'min_2',
    name: 'Minimal (2x)',
    note: 'If you can only train twice, this keeps the essentials and maintains progress.',
    templateForDays: (days) => ({
      name: 'Minimal 2-Day',
      days: [
        { name: 'Day A', patterns: ['squat','push','pull','hinge','core'] },
        { name: 'Day B', patterns: ['squat','pull','push','lunge','core'] },
      ].slice(0, days),
    }),
  },
];
