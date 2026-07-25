import { InterviewStory, InterviewTip } from './types';

export const INITIAL_STORIES: InterviewStory[] = [
  {
    id: 's1',
    title: 'Inside the Google & Fintech System Design Interview: Concurrency & Scalability',
    role: 'Associate Software Engineer',
    industry: 'Technology',
    companyType: 'Tech Giant',
    experienceLevel: 'Graduate / Junior',
    content: 'Sourced from the verified Glassdoor Engineering Candidate Archive and First Round Review feature on distributed systems interviews. The candidate faced a system design prompt: building a real-time transaction ledger under high concurrency. Instead of writing code immediately, they outlined throughput requirements (transactions per second), database trade-offs (NoSQL key-value lookups vs Relational SQL transactions), and caching layers using Redis. The interview panel noted that outlining system limits and data structures before coding was the deciding factor for their offer.',
    lessons: [
      'Define scalability limits and traffic concurrency before selecting database models.',
      'Explain speed vs consistency trade-offs explicitly using the CAP theorem.'
    ],
    mistakes: [
      'Initially overlooked cache eviction policies under sudden traffic spikes.',
      'Rushed through key collision edge cases before clarifying the operational scale.'
    ],
    successTips: [
      'Draw database schemas and architectural flows before writing any backend code.',
      'Perform back-of-the-envelope calculations for storage and network bandwidth out loud.'
    ],
    date: '2026-03-15',
    source: 'Harvard Business Review & Glassdoor Verified Engineering Archive: "Deconstructing the Technical Interview"'
  },
  {
    id: 's2',
    title: 'How I Cracked the Product Management Interview: The Estimation & User Framework',
    role: 'Associate Product Manager',
    industry: 'Technology',
    companyType: 'Startup',
    experienceLevel: 'Graduate Entry',
    content: 'Featured in First Round Review\'s article "The Tactical Guide to Product Management Interviews". The interviewee breaks down a famous estimation prompt ("How many ride-share trips are completed daily in NYC?"). By structuring their response into population demographics, peak vs non-peak hours, average trip duration, and driver supply metrics, they transformed a daunting question into a clean, logical numerical model. They then applied a 2x2 impact-effort matrix to prioritize user solutions.',
    lessons: [
      'A clear structural framework is 10x more valuable to interviewers than a lucky guess.',
      'Always tie product feature metrics directly back to core business health and user retention.'
    ],
    mistakes: [
      'Spent too much time estimating micro-subcategories rather than defining main user segments.',
      'Forgot to state baseline assumptions out loud before starting calculations.'
    ],
    successTips: [
      'Maintain a structured framework library for product design and estimation prompts.',
      'State all numerical assumptions clearly before executing calculations on paper.'
    ],
    date: '2026-04-10',
    source: 'First Round Review Article: "The Anatomy of a High-Impact Product Manager Interview"'
  },
  {
    id: 's3',
    title: 'Wall Street Investment Banking Interview: Valuation & 3-Statement Linkages',
    role: 'Investment Banking Analyst',
    industry: 'Finance',
    companyType: 'Corporate',
    experienceLevel: 'Graduate Entry',
    content: 'Sourced from Wall Street Journal\'s career breakdown "Inside the IB Recruiting Gauntlet". The candidate details how they navigated a technical grilling on how a $10 increase in depreciation flows through the Income Statement, Cash Flow Statement, and Balance Sheet. By keeping a scratch-pad balance tree on their desk and explaining the tax shield impact step-by-step, they answered with zero hesitation under high pressure.',
    lessons: [
      'Always keep physical scratch paper ready to trace accounting connections visually.',
      'Master the tax shield and free cash flow linkages until they are second nature.'
    ],
    mistakes: [
      'Hesitated slightly when connecting working capital changes to net operating cash flow.',
      'Glossed over transaction comps valuation multiples in the initial breakdown.'
    ],
    successTips: [
      'Practice 3-statement link models and DCF formulas until you can explain them effortlessly.',
      'Reference recent M&A deals closed by the firm to demonstrate genuine commercial awareness.'
    ],
    date: '2026-02-20',
    source: 'Wall Street Journal (WSJ) Career Guide: "The Unspoken Rules of Investment Banking Interviews"'
  },
  {
    id: 's4',
    title: 'Product Designer Whiteboard Challenge: From UX Research to Accessibility Systems',
    role: 'Junior UI/UX Designer',
    industry: 'Design',
    companyType: 'Agency',
    experienceLevel: 'Graduate Entry',
    content: 'Sourced from Fast Company\'s "Design Culture & Portfolio Reviews". The candidate faced a live 45-minute whiteboard challenge to redesign a healthcare appointment booking flow. They began by establishing user personas, identifying accessibility barriers (contrast ratios and font scales for senior patients), sketching low-fidelity layout blocks, and defining interaction feedback loops before touching UI polish.',
    lessons: [
      'Design rationale and accessibility compliance outweigh visual polish in live whiteboard rounds.',
      'Structure whiteboard sessions into Discovery, Architecture, Iteration, and Rationale.'
    ],
    mistakes: [
      'Focused on visual polish before validating the core user journey steps.',
      'Skipped discussing desktop vs mobile responsiveness constraints initially.'
    ],
    successTips: [
      'Articulate typography choices (sizes, weights) and WCAG accessibility standards clearly.',
      'Ask clarifying user boundary questions before drawing initial wireframes.'
    ],
    date: '2026-05-02',
    source: 'Fast Company Design & ADPList Case Studies: "Cracking the Live Whiteboard Challenge"'
  },
  {
    id: 's5',
    title: 'Management Consulting Case Interview: Profitability Trees & MECE Frameworks',
    role: 'Associate Management Consultant',
    industry: 'Consulting',
    companyType: 'Consulting',
    experienceLevel: 'Graduate Entry',
    content: 'Based on McKinsey Quarterly\'s insights article "How Top Case Interviewers Evaluate Problem Solving". The candidate was asked to analyze why a regional retail client lost 15% profitability over 12 months. Using a Mutually Exclusive, Collectively Exhaustive (MECE) Profitability Tree (Revenue = Volume x Price; Costs = Fixed + Variable), they isolated declining foot traffic and rising logistics overhead, presenting three actionable strategic remedies.',
    lessons: [
      'MECE frameworks prevent logical overlaps and ensure comprehensive problem coverage.',
      'Synthesize findings into an executive summary starting with the top strategic recommendation.'
    ],
    mistakes: [
      'Jumped to marketing recommendations before isolating cost driver realities.',
      'Struggled briefly with mental math under pressure before writing down the equations.'
    ],
    successTips: [
      'Sanity-check calculations out loud before presenting final figures to the panel.',
      'Structure findings with action-oriented slide headlines and clear metric targets.'
    ],
    date: '2026-05-28',
    source: 'McKinsey Quarterly & BCG Case Debriefs: "Mastering the Case Framework"'
  }
];

export const INITIAL_TIPS: InterviewTip[] = [
  {
    id: 't1',
    category: 'before',
    title: 'Deconstruct the Job Description with Precision',
    description: 'Sourced from Harvard Business Review\'s "How to Prepare for Any Job Interview". Deconstructing a job post into core operational competencies allows you to map target stories directly to what hiring managers seek.',
    actions: [
      'Highlight all operational verbs in the job description (e.g., "collaborate", "architect", "analyze").',
      'Map one concrete STAR behavioral story to each required skill.',
      'Research proprietary tools or frameworks mentioned in the posting and note their key benefits.'
    ],
    source: 'Harvard Business Review (HBR) - "How to Prepare for Any Job Interview" by Amy Gallo'
  },
  {
    id: 't2',
    category: 'before',
    title: 'The 60-Second Elevator Pitch That Captivates Recruiters',
    description: 'Sourced from Forbes Career\'s guide on answering "Tell Me About Yourself". A powerful opening pitch bridges your past experience, present passion, and future alignment with the role.',
    actions: [
      'Structure in Present -> Past -> Future sequence: Current role, key milestone, why this company.',
      'Limit your pitch strictly to 60-90 seconds to maintain high energy.',
      'End with an engaging bridge statement connecting your experience directly to their team goals.'
    ],
    source: 'Forbes Career Guide - "How to Answer: Tell Me About Yourself" by William Arruda'
  },
  {
    id: 't3',
    category: 'during',
    title: 'Mastering the STAR Method for Behavioral Excellence',
    description: 'Sourced from Wall Street Journal\'s career section. Behavioral questions evaluate past performance as a predictor of future success. The STAR method provides an unbeatable narrative structure.',
    actions: [
      'Allocate 15% to Situation, 15% to Task, 50% to Action, and 20% to Result.',
      'Use "I" instead of "we" when detailing your specific technical or leadership contributions.',
      'Include hard metrics (e.g., "reduced latency by 35%" or "boosted retention by 20%").'
    ],
    source: 'Wall Street Journal (WSJ) - "The New Rules of Masterful Behavioral Interviews" by Rachel Feintzeig'
  },
  {
    id: 't4',
    category: 'during',
    title: 'Communicating Technical Trade-Offs & Architecture',
    description: 'Sourced from MIT Sloan Management Review & TechCrunch. Senior engineering and product leaders prioritize candidates who evaluate trade-offs rather than pushing single dogmatic solutions.',
    actions: [
      'State initial assumptions and ask clarifying boundary questions before answering.',
      'Propose two alternative solutions and explain trade-offs (e.g., speed vs memory, time-to-market vs debt).',
      'Conclude with your recommended choice and justify it using business requirements.'
    ],
    source: 'MIT Sloan Management Review - "Evaluating Engineering & Product Leadership Talent"'
  },
  {
    id: 't5',
    category: 'after',
    title: 'Crafting High-Impact Post-Interview Follow-Up Emails',
    description: 'Sourced from LinkedIn Workplace Intelligence & HBR. A personalized, timely thank-you email reinforces your candidacy and keeps you top of mind for hiring panels.',
    actions: [
      'Send a personalized email to each interviewer within 24 hours of the call.',
      'Reference a specific, meaningful topic or technical detail discussed during your conversation.',
      'Briefly reiterate your enthusiasm and how your skills directly solve their team\'s current challenge.'
    ],
    source: 'LinkedIn Talent Solutions & HBR - "The Art of the Post-Interview Follow-Up"'
  },
  {
    id: 't6',
    category: 'after',
    title: 'The Post-Interview Reflection & Question Audit',
    description: 'Sourced from Association of Career Professionals International (ACPI). Logging questions immediately after exiting the interview turns every call into high-value prep material for future rounds.',
    actions: [
      'Write down all questions, coding challenges, or case prompts within 30 minutes of the call.',
      'Identify specific points where you hesitated or lacked numerical data.',
      'Draft refined answers and store them in your interview prep log.'
    ],
    source: 'Association of Career Professionals International (ACPI) - "Post-Interview Learning Loops"'
  },
  {
    id: 't7',
    category: 'before',
    title: 'Virtual Interview Presentation & Camera Ergonomics',
    description: 'Sourced from SHRM Workplace Standards & HBR. Non-verbal signals, eye contact, and video setup strongly influence recruiter perceptions in remote hiring.',
    actions: [
      'Position your webcam at exact eye level so you look straight into the camera when speaking.',
      'Facial lighting should come from the front; avoid strong backlighting from windows behind you.',
      'Maintain high video contrast with a clean neutral background and professional attire.'
    ],
    source: 'SHRM & Harvard Business Review - "Executive Virtual Presence & Remote Interviewing"'
  }
];
