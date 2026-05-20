import type { Competency } from './competencies';

export const PROMPTS: Record<Competency, [string, string, string]> = {
  Leadership: [
    'Tell me about a time you had to make an unpopular decision and bring the team along.',
    'Describe a situation where you stepped up to lead without being asked.',
    'When did you have to motivate a team through a period of uncertainty or change?',
  ],
  Delivery: [
    'Tell me about a time you missed or nearly missed a critical deadline — what happened?',
    'Describe a situation where you had to cut scope under pressure to ship on time.',
    'When did you have to deliver a significant outcome with very limited resources?',
  ],
  Conflict: [
    'Tell me about a meaningful disagreement you had with a peer or manager.',
    'Describe a situation where you had to navigate serious friction within your team.',
    'When did you have to manage competing priorities between stakeholders who disagreed?',
  ],
  Ambiguity: [
    'Tell me about a project with no clear requirements — how did you move it forward?',
    'Describe a time when the strategic direction changed significantly mid-project.',
    'When did you face a problem your organisation had never encountered before?',
  ],
  Influence: [
    'Tell me about a time you convinced others to adopt your approach without formal authority.',
    'Describe a situation where you changed a key decision-maker\'s mind on something important.',
    'When did you have to build broad buy-in across multiple teams or stakeholders?',
  ],
  'Technical Depth': [
    'Tell me about a difficult technical decision you had to make with incomplete information.',
    'Describe a trade-off call you made that had significant downstream consequences.',
    'When did you possess expertise others in the room lacked — and how did you apply it?',
  ],
  'Customer Focus': [
    'Tell me about a time you handled a serious customer complaint or escalation.',
    'Describe a situation where you advocated strongly for user needs against internal pressure.',
    'When did you push back on a product decision because of its impact on customers?',
  ],
  'Growth/Learning': [
    'Tell me about a failure and what you took away from it.',
    'Describe a situation where feedback significantly changed how you approach your work.',
    'When did you proactively close a skill gap that was holding you or your team back?',
  ],
  Hiring: [
    'Tell me about a difficult hire and how you navigated the decision.',
    'Describe a time you raised the bar in a hiring process in a way others hadn\'t considered.',
    'When did you champion a candidate others were skeptical about, and how did it turn out?',
  ],
  'Stakeholder Management': [
    'Tell me about a time you managed seriously misaligned expectations with a key stakeholder.',
    'Describe a situation where you had to work with a particularly difficult executive.',
    'When did you have to navigate two powerful stakeholders with opposing needs on the same project?',
  ],
  'Cross-functional Collaboration': [
    'Tell me about a time you had a critical dependency on another team that wasn\'t cooperating.',
    'Describe a project where you drove a shared goal with groups that had very different priorities.',
    'When did you work effectively with people whose working style was very different from yours?',
  ],
  'Manager of Managers': [
    'Tell me about a time you had to step into a skip-level situation with a team member.',
    'Describe a situation where you coached a manager through a challenge they hadn\'t faced before.',
    'When did you identify and solve a problem that required structural or org-level changes?',
  ],
};
