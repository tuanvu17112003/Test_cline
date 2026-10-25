import { addDays } from '../domain/dates';
import type {
  Activity,
  Priority,
  Project,
  Subtask,
  Task,
  TaskStatus,
} from '../domain/types';

/**
 * Deterministic demo dataset. Dates are relative to "today" so the dashboard,
 * calendar and analytics always have something meaningful to show.
 * Demo records are flagged with `demo: true` so they can be removed again
 * without touching user-created data.
 */
const localTimestamp = (date: string, hour = 9, minute = 0): string => {
  const time = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  return new Date(`${date}T${time}:00`).toISOString();
};

const projectSeeds = [
  {
    id: 'demo-project-website',
    name: 'Website Relaunch',
    description: 'Rebuild the marketing site with a faster stack and a clearer story.',
    color: '#5348e0',
    createdAgo: 21,
  },
  {
    id: 'demo-project-mobile',
    name: 'Mobile App v2',
    description: 'Ship the second generation iOS and Android experience.',
    color: '#0ea5e9',
    createdAgo: 18,
  },
  {
    id: 'demo-project-growth',
    name: 'Q4 Growth Campaign',
    description: 'Referral program, pricing experiments and campaign reporting.',
    color: '#f59e0b',
    createdAgo: 14,
  },
  {
    id: 'demo-project-design',
    name: 'Design System',
    description: 'Shared tokens, components and documentation for every product team.',
    color: '#10b981',
    createdAgo: 12,
  },
] as const;

interface TaskSeed {
  id: string;
  projectId: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: Priority;
  dueOffset: number | null;
  labels: string[];
  subtasks?: [string, boolean][];
  createdAgo: number;
  completedAgo?: number;
}

const taskSeeds: TaskSeed[] = [
  {
    id: 'demo-task-01',
    projectId: 'demo-project-website',
    title: 'Audit current site performance',
    description: 'Lighthouse baseline for the five highest-traffic templates.',
    status: 'done',
    priority: 'high',
    dueOffset: -6,
    labels: ['performance', 'research'],
    subtasks: [
      ['Collect Lighthouse reports', true],
      ['List blocking third-party scripts', true],
    ],
    createdAgo: 16,
    completedAgo: 6,
  },
  {
    id: 'demo-task-02',
    projectId: 'demo-project-website',
    title: 'Ship new homepage hero',
    description: 'Headline, product screenshot and a single primary call to action.',
    status: 'in_progress',
    priority: 'critical',
    dueOffset: 1,
    labels: ['design', 'frontend'],
    subtasks: [
      ['Final copy approved', true],
      ['Responsive layout', false],
      ['Dark mode artwork', false],
    ],
    createdAgo: 9,
  },
  {
    id: 'demo-task-03',
    projectId: 'demo-project-website',
    title: 'Migrate blog to MDX',
    description: 'Move 42 posts and keep the existing URLs redirecting correctly.',
    status: 'todo',
    priority: 'medium',
    dueOffset: 6,
    labels: ['content'],
    createdAgo: 7,
  },
  {
    id: 'demo-task-04',
    projectId: 'demo-project-website',
    title: 'Define analytics events',
    description: 'Agree on an event taxonomy before instrumenting the new pages.',
    status: 'backlog',
    priority: 'low',
    dueOffset: null,
    labels: ['analytics'],
    createdAgo: 5,
  },
  {
    id: 'demo-task-05',
    projectId: 'demo-project-website',
    title: 'Fix mobile navigation overlap',
    description: 'Menu overlaps the hero on screens narrower than 380px.',
    status: 'todo',
    priority: 'high',
    dueOffset: -2,
    labels: ['bug', 'frontend'],
    createdAgo: 8,
  },
  {
    id: 'demo-task-06',
    projectId: 'demo-project-mobile',
    title: 'Implement biometric login',
    description: 'Face ID and fingerprint unlock with a PIN fallback.',
    status: 'in_progress',
    priority: 'high',
    dueOffset: 3,
    labels: ['auth', 'ios'],
    subtasks: [
      ['Keychain storage', true],
      ['Android integration', false],
    ],
    createdAgo: 12,
  },
  {
    id: 'demo-task-07',
    projectId: 'demo-project-mobile',
    title: 'Design onboarding flow',
    description: 'Three screens, skippable, with a progress indicator.',
    status: 'done',
    priority: 'medium',
    dueOffset: -3,
    labels: ['design'],
    subtasks: [['Prototype reviewed', true]],
    createdAgo: 17,
    completedAgo: 3,
  },
  {
    id: 'demo-task-08',
    projectId: 'demo-project-mobile',
    title: 'Offline sync conflict handling',
    description: 'Last-write-wins is not enough — needs a merge review screen.',
    status: 'backlog',
    priority: 'critical',
    dueOffset: null,
    labels: ['sync'],
    createdAgo: 4,
  },
  {
    id: 'demo-task-09',
    projectId: 'demo-project-mobile',
    title: 'Reduce cold start time',
    description: 'Target 1.2s from tap to interactive on a mid-range Android device.',
    status: 'todo',
    priority: 'high',
    dueOffset: 8,
    labels: ['performance'],
    createdAgo: 6,
  },
  {
    id: 'demo-task-10',
    projectId: 'demo-project-mobile',
    title: 'Release 2.0 beta build',
    description: 'Cut the build, write release notes and invite the beta group.',
    status: 'todo',
    priority: 'critical',
    dueOffset: 0,
    labels: ['release'],
    subtasks: [
      ['Release notes', true],
      ['Beta invites', false],
    ],
    createdAgo: 2,
  },
  {
    id: 'demo-task-11',
    projectId: 'demo-project-growth',
    title: 'Draft Q4 campaign brief',
    description: 'Audience, offer, channels and the measurement plan.',
    status: 'done',
    priority: 'high',
    dueOffset: -8,
    labels: ['planning'],
    createdAgo: 20,
    completedAgo: 8,
  },
  {
    id: 'demo-task-12',
    projectId: 'demo-project-growth',
    title: 'Launch referral program',
    description: 'Two-sided incentive with a cap of five referrals per account.',
    status: 'in_progress',
    priority: 'high',
    dueOffset: 5,
    labels: ['launch', 'email'],
    subtasks: [
      ['Incentive rules signed off', true],
      ['Landing page', false],
      ['Fraud checks', false],
    ],
    createdAgo: 10,
  },
  {
    id: 'demo-task-13',
    projectId: 'demo-project-growth',
    title: 'A/B test pricing page',
    description: 'Three variants, two-week window, 95% confidence target.',
    status: 'todo',
    priority: 'medium',
    dueOffset: 12,
    labels: ['experiment'],
    createdAgo: 3,
  },
  {
    id: 'demo-task-14',
    projectId: 'demo-project-growth',
    title: 'Weekly metrics review',
    description: 'Pull the funnel, annotate the deltas and share with the team.',
    status: 'todo',
    priority: 'low',
    dueOffset: 2,
    labels: ['ops'],
    createdAgo: 1,
  },
  {
    id: 'demo-task-15',
    projectId: 'demo-project-design',
    title: 'Document colour tokens',
    description: 'Every token needs a meaning, a contrast pair and a dark mode value.',
    status: 'done',
    priority: 'medium',
    dueOffset: -1,
    labels: ['docs'],
    createdAgo: 11,
    completedAgo: 1,
  },
  {
    id: 'demo-task-16',
    projectId: 'demo-project-design',
    title: 'Build data table component',
    description: 'Sortable, resizable, keyboard friendly and virtualised above 200 rows.',
    status: 'in_progress',
    priority: 'critical',
    dueOffset: 4,
    labels: ['components'],
    subtasks: [
      ['Column resizing', true],
      ['Keyboard navigation', false],
      ['Empty + loading states', false],
    ],
    createdAgo: 6,
  },
  {
    id: 'demo-task-17',
    projectId: 'demo-project-design',
    title: 'Accessibility audit checklist',
    description: 'Cover focus order, contrast, landmarks and reduced motion.',
    status: 'backlog',
    priority: 'high',
    dueOffset: -4,
    labels: ['a11y'],
    createdAgo: 7,
  },
  {
    id: 'demo-task-18',
    projectId: 'demo-project-design',
    title: 'Publish v1.2 changelog',
    description: 'Highlight the new form controls and the deprecations.',
    status: 'todo',
    priority: 'low',
    dueOffset: null,
    labels: ['docs'],
    createdAgo: 2,
  },
  {
    id: 'demo-task-19',
    projectId: 'demo-project-website',
    title: 'Write launch announcement',
    description: 'Blog post plus social variations, reviewed by marketing.',
    status: 'todo',
    priority: 'medium',
    dueOffset: 10,
    labels: ['content'],
    createdAgo: 1,
  },
  {
    id: 'demo-task-20',
    projectId: 'demo-project-mobile',
    title: 'Instrument crash reporting',
    description: 'Symbolicated crashes for both platforms with release health dashboards.',
    status: 'done',
    priority: 'critical',
    dueOffset: -5,
    labels: ['observability'],
    createdAgo: 13,
    completedAgo: 5,
  },
];

export interface DemoDataset {
  projects: Project[];
  tasks: Task[];
  activities: Activity[];
}

export function createDemoData(today: string): DemoDataset {
  const projects: Project[] = projectSeeds.map((seed) => {
    const createdAt = localTimestamp(addDays(today, -seed.createdAgo), 9, 0);
    return {
      id: seed.id,
      name: seed.name,
      description: seed.description,
      color: seed.color,
      createdAt,
      updatedAt: createdAt,
      demo: true,
    };
  });

  const columnCounters = new Map<string, number>();
  const tasks: Task[] = taskSeeds.map((seed) => {
    const key = `${seed.projectId}::${seed.status}`;
    const order = columnCounters.get(key) ?? 0;
    columnCounters.set(key, order + 1);

    const createdAt = localTimestamp(addDays(today, -seed.createdAgo), 10, 30);
    const completedAt =
      seed.completedAgo === undefined
        ? null
        : localTimestamp(addDays(today, -seed.completedAgo), 16, 15);
    const subtasks: Subtask[] = (seed.subtasks ?? []).map(([title, done], index) => ({
      id: `${seed.id}-sub-${index + 1}`,
      title,
      done,
    }));

    return {
      id: seed.id,
      projectId: seed.projectId,
      title: seed.title,
      description: seed.description,
      status: seed.status,
      priority: seed.priority,
      dueDate: seed.dueOffset === null ? null : addDays(today, seed.dueOffset),
      labels: seed.labels,
      subtasks,
      order,
      createdAt,
      updatedAt: completedAt ?? createdAt,
      completedAt,
      demo: true,
    };
  });

  const activities: Activity[] = [];
  let activityIndex = 1;
  const pushActivity = (activity: Omit<Activity, 'id'>) => {
    activities.push({ ...activity, id: `demo-activity-${activityIndex}` });
    activityIndex += 1;
  };

  for (const project of projects) {
    pushActivity({
      kind: 'project-created',
      message: `Created project “${project.name}”`,
      at: project.createdAt,
      projectId: project.id,
    });
  }
  for (const task of tasks) {
    if (task.completedAt) {
      pushActivity({
        kind: 'task-completed',
        message: `Completed “${task.title}”`,
        at: task.completedAt,
        projectId: task.projectId,
        taskId: task.id,
      });
    } else if (task.status === 'in_progress') {
      pushActivity({
        kind: 'task-moved',
        message: `Moved “${task.title}” to In Progress`,
        at: task.updatedAt,
        projectId: task.projectId,
        taskId: task.id,
      });
    }
  }
  activities.sort((a, b) => b.at.localeCompare(a.at));

  return { projects, tasks, activities };
}
