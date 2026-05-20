export const COMPETENCIES = [
  'Leadership',
  'Delivery',
  'Conflict',
  'Ambiguity',
  'Influence',
  'Technical Depth',
  'Customer Focus',
  'Growth/Learning',
  'Hiring',
  'Stakeholder Management',
  'Cross-functional Collaboration',
  'Manager of Managers',
] as const;

export type Competency = typeof COMPETENCIES[number];
