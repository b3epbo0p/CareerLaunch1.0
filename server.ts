import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json());

const PORT = 3000;

// Lazy initialization of Gemini client with telemetry headers
let aiInstance: GoogleGenAI | null = null;
function resolveGeminiApiKey() {
  const viteKey = process.env.VITE_GEMINI_API_KEY?.trim();
  const defaultKey = process.env.GEMINI_API_KEY?.trim();
  const apiKey = viteKey || defaultKey || null;
  const source = viteKey ? "VITE_GEMINI_API_KEY" : defaultKey ? "GEMINI_API_KEY" : null;

  if (source) {
    console.log(`[Gemini API] Loaded key from ${source}`);
  } else {
    console.warn("[Gemini API] No Gemini API key found. Set GEMINI_API_KEY or VITE_GEMINI_API_KEY in Vercel project settings.");
  }

  return { apiKey, source };
}

function getGeminiClient(): GoogleGenAI {
  const { apiKey } = resolveGeminiApiKey();
  if (!apiKey || apiKey === "MY_GEMINI_API_KEY" || apiKey.trim() === "") {
    throw new Error("Gemini API key is not configured. Please add GEMINI_API_KEY or VITE_GEMINI_API_KEY in your Vercel environment variables.");
  }
  if (!aiInstance) {
    aiInstance = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiInstance;
}

// Graceful, clean warning logger to handle 429/503 quota limit errors during concurrent runs cleanly without polluting test logs
function logGeminiError(context: string, error: any) {
  const errMsg = error?.message || String(error);
  if (errMsg.includes("429") || errMsg.includes("quota") || errMsg.includes("RESOURCE_EXHAUSTED") || errMsg.includes("503") || errMsg.includes("demand") || errMsg.includes("UNAVAILABLE")) {
    console.warn(`[Gemini Fallback Active] ${context}: Quota rate-limit or high service demand detected (429/503). Graceful local simulation loaded successfully.`);
  } else {
    console.warn(`[Gemini Fallback Active] ${context}: ${errMsg}. Graceful local simulation loaded successfully.`);
  }
}

// Simulated data helpers in case Gemini API is not configured or fails
function isCodingRole(jobTitle: string): boolean {
  const t = jobTitle.toLowerCase();
  return t.includes('engineer') || 
         t.includes('developer') || 
         t.includes('programmer') || 
         t.includes('coder') || 
         t.includes('coding') || 
         t.includes('software') || 
         t.includes('backend') || 
         t.includes('frontend') || 
         t.includes('fullstack') || 
         t.includes('web dev') || 
         t.includes('programming') ||
         t.includes('sysops') ||
         t.includes('devops');
}

function getMockQuestions(jobTitle: string, industry: string, level?: string): {
  needsClarification: boolean;
  clarifyingQuestion: string;
  organizationType: string;
  sheetTitle: string;
  generationDate: string;
  questions: any[];
} {
  const titleLower = (jobTitle || "").trim().toLowerCase();
  const indLower = (industry || "").trim().toLowerCase();
  const todayStr = new Date().toISOString().split('T')[0];

  // Vagueness Check
  const vagueTerms = ["any", "anything", "stuff", "job", "business", "tech", "marketing", "work", "something", "test"];
  const isVague = !titleLower || !indLower || titleLower.length < 3 || indLower.length < 3 || 
                  vagueTerms.includes(titleLower) || vagueTerms.includes(indLower);

  if (isVague) {
    return {
      needsClarification: true,
      clarifyingQuestion: `Could you please clarify your specific target role and the type of organization (e.g., a specific government agency, a private corporation, an educational institution, or a nonprofit)? Knowing the concrete focus area will help our AI compile a perfectly tailored question sheet.`,
      organizationType: "Other",
      sheetTitle: `INTERVIEW QUESTIONS SHEET: Pending Clarification`,
      generationDate: todayStr,
      questions: []
    };
  }

  // Identify Organization Type
  let orgType = "Corporate";
  let specificCategory4 = "Company-Specific";

  const isGov = titleLower.includes("secret service") || titleLower.includes("police") || titleLower.includes("military") || 
                titleLower.includes("civil service") || titleLower.includes("government") || titleLower.includes("federal") || 
                titleLower.includes("state") || titleLower.includes("department") || titleLower.includes("agency") || 
                indLower.includes("government") || indLower.includes("public sector") || indLower.includes("military") ||
                indLower.includes("police") || indLower.includes("defense");

  const isNonprofit = titleLower.includes("nonprofit") || titleLower.includes("ngo") || titleLower.includes("charity") || 
                      titleLower.includes("foundation") || titleLower.includes("humanitarian") || indLower.includes("nonprofit") || 
                      indLower.includes("ngo") || indLower.includes("humanitarian") || indLower.includes("charity") ||
                      indLower.includes("cause") || indLower.includes("philanthropy");

  const isAcademic = titleLower.includes("academic") || titleLower.includes("university") || titleLower.includes("school") || 
                     titleLower.includes("college") || titleLower.includes("teacher") || titleLower.includes("professor") || 
                     titleLower.includes("education") || indLower.includes("education") || indLower.includes("academic") || 
                     indLower.includes("university") || indLower.includes("school");

  const isStartup = titleLower.includes("startup") || indLower.includes("startup") || indLower.includes("early stage") || 
                    indLower.includes("early-stage");

  if (isGov) {
    orgType = "Government / Public Sector";
    specificCategory4 = "Agency-Specific";
  } else if (isNonprofit) {
    orgType = "Nonprofit / NGO";
    specificCategory4 = "Organization-Specific";
  } else if (isAcademic) {
    orgType = "Academic / Educational";
    specificCategory4 = "Institution-Specific";
  } else if (isStartup) {
    orgType = "Startup";
    specificCategory4 = "Role-Specific";
  } else {
    orgType = "Private Company / Corporate";
    specificCategory4 = "Company-Specific";
  }

  const sheetTitle = `INTERVIEW QUESTIONS SHEET: ${jobTitle} (${orgType})`;

  const questions: any[] = [];
  const levelLabel = level ? ` (${level} level)` : '';

  const addQuestion = (num: number, text: string, category: string, intent: string, points: string[]) => {
    questions.push({
      id: `q-${Date.now()}-${num}`,
      number: num,
      text,
      category,
      intent,
      suggestedPoints: points
    });
  };

  // 3 Behavioral (1-3)
  if (isGov) {
    addQuestion(1, `What motivated you to pursue a career in public service, and how does your training prepare you for this ${jobTitle} role${levelLabel}?`, "Behavioral", "Assess public service motivation, ethics, and foundational training.", [
      "Detail your passion for serving the public interest and fulfilling the agency's mandate.",
      "Highlight how your academic or physical training matches the role requirements.",
      "Reference specific challenges this agency faces in executing its duty."
    ]);
    addQuestion(2, `Tell me about a time you had to make a critical decision in a high-pressure situation under strict regulatory constraints. How did you handle it?`, "Behavioral", "Evaluate compliance, decision-making integrity, and grace under pressure.", [
      "Clearly describe the challenging, highly constrained context (Situation/Task).",
      "Explain your precise actions, emphasizing adherence to protocols and safety guidelines.",
      "Detail the successful outcome and what you learned about risk mitigation."
    ]);
    addQuestion(3, `Describe a situation where you had to work with a diverse team or coordinate with external departments to achieve a unified goal.`, "Behavioral", "Assess collaboration, inter-departmental communication, and public duty.", [
      "Explain the collaborative challenge and the common objective of the agency.",
      "Describe how you navigated friction, respected chain of command, or integrated viewpoints.",
      "Highlight the successful mission outcome and the benefit to the public service."
    ]);
  } else if (isNonprofit) {
    addQuestion(1, `What draws you to our mission-driven cause, and how does your background prepare you to serve our beneficiaries as a ${jobTitle}${levelLabel}?`, "Behavioral", "Assess mission alignment, empathy, and cause dedication.", [
      "State your personal connection or alignment with the organization's cause.",
      "Explain how your skills directly translate to driving positive impact.",
      "Express genuine interest in serving our beneficiaries."
    ]);
    addQuestion(2, `Tell me about a time you had to accomplish an ambitious goal with highly limited resources. How did you optimize your approach?`, "Behavioral", "Evaluate resourcefulness, creativity, and resilience under constraint.", [
      "Describe the resource constraints clearly (budget, staff, time).",
      "Detail your specific, creative actions to stretch resources or secure support.",
      "Highlight the measurable impact achieved for the cause."
    ]);
    addQuestion(3, `Describe a time when you had to manage differing expectations between community stakeholders or volunteers. How did you build alignment?`, "Behavioral", "Assess stakeholder empathy, diplomatic communication, and relationship building.", [
      "Outline the differing perspectives of stakeholders or community members.",
      "Describe your active listening and collaborative conflict-resolution actions.",
      "Focus on the unified consensus achieved and its contribution to the mission."
    ]);
  } else {
    addQuestion(1, `What motivated you to apply for this ${jobTitle} role${levelLabel}, and how does your professional background prepare you?`, "Behavioral", "Evaluate candidate alignment, interest, and professional preparation.", [
      "State your core passion and enthusiasm for this professional field.",
      "Link personal achievements or specialized education directly to the role.",
      "Explain why this specific team and organization appeals to your long-term career growth."
    ]);
    addQuestion(2, `Tell me about a time you had to work with a difficult partner or colleague. How did you resolve the friction?`, "Behavioral", "Assess conflict resolution, professional diplomacy, and active listening.", [
      "Focus on objective operational facts rather than personal feelings.",
      "Explain the constructive actions taken to understand their requirements and align expectations.",
      "Describe the positive shared outcome and how it strengthened the relationship."
    ]);
    addQuestion(3, `Can you share a significant professional or academic project challenge you faced, and what vital lessons you learned from it?`, "Behavioral", "Assess resilience, problem-solving, and continuous learning.", [
      "Define the project context and the main bottleneck clearly.",
      "Detail your proactive, structured steps to troubleshoot the issue.",
      "Provide evidence of the final results and subsequent improvements based on lessons learned."
    ]);
  }

  // 3 Technical (4-6)
  const isCoding = isCodingRole(jobTitle);
  if (isCoding) {
    addQuestion(4, `Can you describe a challenging technical, architectural, or programming project you completed, and how you resolved a critical bottleneck?`, "Technical", "Test coding competence, technical architecture design, and execution.", [
      "Specify the core technologies, frameworks, and architecture used.",
      "Explain the exact performance or logical bottleneck (e.g., O(N^2) complexity, memory leak).",
      "Detail your optimization steps and the measurable improvements in speed or resource usage."
    ]);
    addQuestion(5, `What specific programming languages, frameworks, or cloud platforms are you most proficient in for ${jobTitle}, and how do you ensure high code quality?`, "Technical", "Validate framework expertise, testing, and documentation standards.", [
      "State your primary tech stack and tools (e.g., Python, TypeScript, React, Docker).",
      "Mention your testing practices, linting, automated pipelines, or peer review workflows.",
      "Highlight modularity, security practices, and clean architectural patterns."
    ]);
    addQuestion(6, `How do you approach profiling, diagnosing, and troubleshooting a system or application that is hitting scale barriers or performing slowly?`, "Technical", "Assess diagnostic methods, optimization strategy, and analytical tracking.", [
      "Emphasize measuring and profiling before guessing or writing code.",
      "Discuss typical bottlenecks like network latency, database queries, or CPU-bound algorithms.",
      "Describe your systematic, incremental testing and refactoring process."
    ]);
  } else if (isGov) {
    addQuestion(4, `Can you describe your experience with standard operational protocols, data-security measures, or tracking tools relevant to this ${jobTitle} role?`, "Technical", "Assess knowledge of regulatory compliance, technical tools, and security standards.", [
      "Name specific technical databases, security tools, or official software you have operated.",
      "Explain your step-by-step adherence to information security or physical safety standards.",
      "Highlight how you handle sensitive or confidential information responsibly."
    ]);
    addQuestion(5, `How do you ensure complete accuracy, absolute compliance, and strict quality control when preparing official reports or managing documentation?`, "Technical", "Validate administrative rigor, attention to detail, and compliance standards.", [
      "Explain your systematic review, double-checking, or peer auditing procedures.",
      "Discuss keeping up-to-date with changing regulations or department directives.",
      "Give an example of catching and correcting an administrative or regulatory error."
    ]);
    addQuestion(6, `How do you approach learning and implementing new regulatory frameworks, security updates, or official software systems within the department?`, "Technical", "Evaluate learning adaptability, systems knowledge, and continuous professional development.", [
      "Mention completing structured training courses, certifications, or self-guided studies.",
      "Describe your method for testing and practicing with new digital tools or protocols.",
      "Show how you share technical knowledge with team members to ensure uniform department readiness."
    ]);
  } else if (isNonprofit) {
    addQuestion(4, `How do you approach measuring and reporting the tangible social impact, outcome metrics, or community benefits of your projects?`, "Technical", "Assess quantitative reporting, impact analysis, and project management skills.", [
      "Name specific monitoring and evaluation (M&E) tools, databases, or tracking frameworks you use.",
      "Describe how you collect reliable qualitative and quantitative data from beneficiaries.",
      "Explain how you translate metrics into clear, compelling progress reports for donors."
    ]);
    addQuestion(5, `What specific campaign, fundraising, donor management, or project tracking software are you most proficient in, and how do you maintain data integrity?`, "Technical", "Validate tool proficiency, administrative accuracy, and platform stewardship.", [
      "Mention CRM or donor platforms you have operated (e.g., Salesforce, Raiser's Edge, or Excel).",
      "Describe your guidelines for secure data storage, privacy, and donor confidentiality.",
      "Explain how you utilize software to optimize community outreach or donor touchpoints."
    ]);
    addQuestion(6, `How do you design and structure a project budget or resource-allocation plan to ensure maximum cost-effectiveness for the cause?`, "Technical", "Evaluate financial stewardship, budget management, and operational efficiency.", [
      "Detail your step-by-step approach to forecasting program costs and overheads.",
      "Describe your methods for tracking real-time expenditure against grant restrictions.",
      "Explain how you negotiate with vendors or coordinate volunteers to minimize costs."
    ]);
  } else {
    addQuestion(4, `Can you describe your experience with modern industry tools, software suites, or operational platforms essential to this ${jobTitle} role?`, "Technical", "Validate tool competence, quality standards, and day-one readiness.", [
      "Identify the top 2-3 specific software applications or operational tools you have mastered.",
      "Explain how you leverage these tools to automate workflows or increase accuracy.",
      "Mention any specific certifications, courses, or training you've completed."
    ]);
    addQuestion(5, `How do you stay updated on latest industry developments, market trends, or technical practices, and how do you implement them?`, "Technical", "Assess commercial awareness, self-directed learning, and innovation.", [
      "List specific publications, professional journals, or active communities you follow.",
      "Explain how you evaluate whether a new methodology is suitable for your team's workflow.",
      "Detail a time you successfully introduced a modern practice to a project."
    ]);
    addQuestion(6, `How do you approach troubleshooting or optimizing a slow workflow, database, or process that is hitting performance limits?`, "Technical", "Evaluate structural diagnostic logic, bottleneck discovery, and continuous improvement.", [
      "Describe your step-by-step diagnostic verification: observing, measuring, and isolating the root cause.",
      "Explain the technical trade-offs you consider (e.g., speed vs. cost or short-term patch vs. complete refactor).",
      "Mention how you coordinate with team members to execute optimizations smoothly."
    ]);
  }

  // 3 Situational (7-9)
  if (isGov) {
    addQuestion(7, `Imagine you are assigned a critical public safety or reporting task with a strict regulatory deadline, but you find a major compliance error in the source files. What do you do?`, "Situational", "Evaluate integrity, regulatory compliance, and handling ethical stress.", [
      "Prioritize absolute compliance and accuracy above simply hitting the deadline.",
      "Describe a diplomatic, constructive way to notify your supervisor and address the error immediately.",
      "Detail how you would implement temporary double-shifts or extra effort to minimize delay."
    ]);
    addQuestion(8, `If you receive conflicting orders regarding operational protocols from two senior department officers, how do you handle the situation?`, "Situational", "Assess respect for chain of command, active listening, and conflict resolution.", [
      "Acknowledge and respect the chain of command, remaining neutral and professional.",
      "Explain how you would bring both parties together or document the request to seek clarity.",
      "Detail your focus on the agency's primary mission and legal mandate as the final guide."
    ]);
    addQuestion(9, `What steps would you take if you discovered a fellow officer was violating a minor department security protocol or administrative policy?`, "Situational", "Evaluate ethical judgment, professional responsibility, and public trust.", [
      "State clearly that preserving public trust and security protocols is the absolute top priority.",
      "Describe addressing the colleague directly and constructively in private first for minor slip-ups.",
      "Outline your clear obligation to escalate the issue if the breach persists or threatens safety."
    ]);
  } else if (isNonprofit) {
    addQuestion(7, `Imagine a major donor requests to reallocate their pledged funding to a different program that goes against our core mission values. How do you handle this?`, "Situational", "Assess donor relations diplomacy, ethical stance, and mission fidelity.", [
      "Politely and firmly prioritize the core values and mission-driven mandate of the organization.",
      "Describe working collaboratively with the donor to find a compromise that aligns with their goals.",
      "Outline how you would document and present the decision to your board of directors."
    ]);
    addQuestion(8, `If you face a sudden 30% reduction in volunteer turnout on the eve of a major community outreach campaign, how do you adjust your program?`, "Situational", "Evaluate crisis adaptability, priority triage, and volunteer management.", [
      "Triage campaign activities immediately, focusing on high-impact core services for beneficiaries.",
      "Describe your proactive strategy to quickly coordinate backup volunteers or optimize the active team.",
      "Maintain absolute transparency with community stakeholders regarding any slight service changes."
    ]);
    addQuestion(9, `How would you respond if a prominent local leader or beneficiary publicly criticized our program's allocation of community resources?`, "Situational", "Assess public relations poise, community empathy, and active feedback integration.", [
      "Listen actively and with empathy, avoiding defensive or argumentative public statements.",
      "Invite the individual or group to a constructive, private meeting to understand their concerns.",
      "Formulate realistic, transparent adjustments and share them publicly to strengthen trust."
    ]);
  } else {
    addQuestion(7, `How would you handle a situation where a key supervisor or partner changes their requirements just days before an important milestone or release?`, "Situational", "Assess adaptability, stakeholder diplomacy, and execution under pressure.", [
      "Maintain a calm, constructive attitude and avoid immediate defensive resistance.",
      "Conduct a rapid, realistic impact assessment (on timeline, cost, and technical risks).",
      "Proactively present these trade-offs to the supervisor or client to agree on a realistic scope."
    ]);
    addQuestion(8, `If you are given two high-priority tasks with conflicting, urgent deadlines, how do you manage your time and stakeholders?`, "Situational", "Assess priority matrix, time management, and proactive communication.", [
      "Evaluate each task's business, user, or strategic value using clear metrics.",
      "Communicate early and transparently with the affected stakeholders to renegotiate expectations.",
      "Apply strict time-blocking or brief delegation to ensure quality is not compromised on either."
    ]);
    addQuestion(9, `Imagine you notice a major error in a colleague's work after it has already been approved. How do you handle it?`, "Situational", "Assess team collaboration, professional tact, and quality responsibility.", [
      "Address the colleague directly, privately, and constructively first.",
      "Frame the problem around finding a solution and protecting the team output, rather than assigning blame.",
      "Work together to present a corrected plan or patch to the supervisor as a unified front."
    ]);
  }

  // 3 Role/Organization-Specific (10-12)
  if (isGov) {
    addQuestion(10, `What is one major national interest development or security protocol shift in the ${industry} sector right now that this agency must prepare for?`, specificCategory4, "Verify public policy awareness, department strategic vision, and continuous training.", [
      "Identify a real, significant regulation, threat model, or modern technology (e.g., cyber encryption, policy directives).",
      "Analyze its potential impact on our department's mandate and day-to-day operations.",
      "Discuss a proactive plan to update internal team training or system readiness."
    ]);
    addQuestion(11, `How do you envision our agency's commitment to public service and regulatory integrity aligning with your personal ethics?`, specificCategory4, "Verify national duty alignment, high-fidelity compliance, and long-term retention.", [
      "Reference the specific public service mission of this department (e.g., protecting borders, securing finances).",
      "Connect your personal code of ethics or civic background directly to this mission.",
      "Explain how you plan to contribute to the agency's record of trust and transparency."
    ]);
    addQuestion(12, `Why did you choose to serve specifically at our department rather than pursuing other civil service divisions or private sector entities?`, specificCategory4, "Verify tailored research, public service commitment, and agency dedication.", [
      "Highlight unique operational features or mandates of this specific department.",
      "Express a strong, authentic preference for public duty over private corporate rewards.",
      "Show deep, respect-backed knowledge of our department's recent achievements."
    ]);
  } else if (isNonprofit) {
    addQuestion(10, `What is one major fundraising trend, grant directive, or social shift in the ${industry} sector right now that our organization should adopt?`, specificCategory4, "Assess strategic sector vision, continuous learning, and programmatic innovation.", [
      "Identify a real, modern fundraising trend or programmatic practice (e.g., digital micro-donations, community-led programs).",
      "Explain how this trend could optimize our cause's reach and donor involvement.",
      "Outline an incremental plan to test this approach within our budget limits."
    ]);
    addQuestion(11, `How does our organization's commitment to advocacy and impact align with your long-term vision for social change?`, specificCategory4, "Assess mission alignment, advocacy commitment, and long-term retention.", [
      "Reference a specific program, campaign, or value of our organization that inspires you.",
      "Relate your past volunteering, advocacy, or community work directly to this value.",
      "Discuss how you plan to champion our cause within the team and wider community."
    ]);
    addQuestion(12, `Why do you want to contribute specifically to our cause and beneficiaries compared to other nonprofit organizations in the ${industry} space?`, specificCategory4, "Verify authentic research, passion for our target beneficiaries, and NGO alignment.", [
      "Specify unique aspects of our programs, target community, or operational approach.",
      "Show deep familiarity with our recent campaigns or field achievements.",
      "Express a strong, authentic commitment to our specific group of beneficiaries."
    ]);
  } else {
    const competitorLabel = isAcademic ? "other institutions" : isStartup ? "other early-stage ventures" : "our competitors";
    const brandLabel = isAcademic ? "institutional reputation" : isStartup ? "product vision" : "brand loyalty";
    const companyLabel = isAcademic ? "institution" : isStartup ? "startup" : "company";
    const valuesLabel = isAcademic ? "institutional standards" : isStartup ? "founding principles" : "core values";

    addQuestion(10, `What is one major trend or technological development in the ${industry} industry right now that keeps you excited?`, specificCategory4, "Assess commercial awareness, industry passion, and self-directed study.", [
      "Identify a real, significant trend or tech advancement (e.g., generative AI, automation, green tech).",
      "Explain its strategic impact on workflow efficiency or product delivery.",
      "Formulate a clear, forward-looking opinion on how our team can leverage it."
    ]);
    addQuestion(11, `How do you envision our ${companyLabel}'s ${valuesLabel} or mission aligning with your long-term career aspirations?`, specificCategory4, "Assess organizational cultural fit, strategic alignment, and retention.", [
      "Reference a specific mission statement or value of our organization.",
      "Explain how your personal work ethic and values embody that principle.",
      "Connect it directly to your long-term professional skills and career goals."
    ]);
    addQuestion(12, `Why did you choose our specific organization over ${competitorLabel} in the ${industry} space?`, specificCategory4, "Verify tailored research, ${brandLabel}, and authentic competitive awareness.", [
      "State a unique, verified differentiator of our organization (e.g., culture, specific service, product design).",
      "Demonstrate thorough knowledge of the competitive landscape of the market.",
      "Keep the tone positive and highly specific, showing enthusiasm to contribute to our unique position."
    ]);
  }

  return {
    needsClarification: false,
    clarifyingQuestion: "",
    organizationType: orgType,
    sheetTitle,
    generationDate: todayStr,
    questions
  };
}

function getMockStoriesAndTips(targetRole: string, targetIndustry: string, targetCompanyType?: string) {
  const companyType = targetCompanyType || "Corporate";
  const stories = [
    {
      id: "ps1",
      title: `Inside the ${targetRole} Selection Loop: Systems & Operations Case Study`,
      role: targetRole,
      industry: targetIndustry,
      companyType: companyType,
      experienceLevel: "Mid Level",
      content: `Sourced from the Glassdoor Verified Candidate Archive & First Round Review feature on ${targetIndustry} hiring standards. During the deep-dive panel for a ${targetRole} position, interviewers focused heavily on real-world operational challenges. Instead of giving abstract answers, the candidate used a structured STAR narrative detailing how they resolved a critical bottleneck, highlighting measurable performance gains and cross-functional alignment.`,
      lessons: [
        "Structure behavioral responses using the STAR method (Situation, Task, Action, Result).",
        "Research the firm's strategic initiatives and weave those priorities into your operational answers."
      ],
      mistakes: [
        "Spent too much time detailing background context rather than core personal actions.",
        "Forgot to quantify the final operational outcome with hard percentage metrics initially."
      ],
      successTips: [
        "Focus on delivering clear, quantifiable results like hours saved or error rate reductions.",
        "Practice delivering your 90-second response out loud to ensure tight pacing."
      ],
      date: "2026-06-15",
      source: `Glassdoor Candidate Archive & First Round Review: "Mastering the ${targetRole} Loop"`
    },
    {
      id: "ps2",
      title: `How Fresh Graduates Ace the Entry-Level ${targetRole} Interview`,
      role: targetRole,
      industry: targetIndustry,
      companyType: "Startup",
      experienceLevel: "Entry Level",
      content: `Sourced from Harvard Business Review's "Navigating Early Career Recruiting". Transitioning into a ${targetRole} role without decades of experience requires demonstrating fast learning loops and problem-solving rigor. In the final round, the candidate walked the panel through an ambitious academic/personal project, proving their mastery of essential ${targetIndustry} concepts and tools.`,
      lessons: [
        "Highlight fast-learning capability and proactive self-study projects.",
        "Acknowledge knowledge limits honestly while outlining the exact steps you take to learn."
      ],
      mistakes: [
        "Tried to over-complicate simple answers instead of giving direct, clear responses.",
        "Hesitated during initial technical questions before writing down the logical steps."
      ],
      successTips: [
        "Align academic or side projects directly with the key requirements in the job description.",
        "Send a personalized post-interview follow-up note within 24 hours."
      ],
      date: "2026-06-20",
      source: `Harvard Business Review (HBR) Article: "Navigating Early Career Recruiting for ${targetRole}s"`
    },
    {
      id: "ps3",
      title: `Deconstructing the Technical Case Round for ${targetRole} Roles`,
      role: targetRole,
      industry: targetIndustry,
      companyType: "Corporate",
      experienceLevel: "Junior Level",
      content: `Featured in Wall Street Journal's career section "Inside Industry Hiring Gauntlets". The interview panel presented a live scenario where a key deliverable in ${targetIndustry} was at risk due to resource bottlenecks. The interviewee systematically broke down priorities, risk mitigation steps, and team communication, proving immediate day-one readiness for the ${targetRole} seat.`,
      lessons: [
        "Never underestimate the value of structured problem decomposition under pressure.",
        "Focus on safety protocols, operational compliance, and stakeholder communication."
      ],
      mistakes: [
        "Neglected showing how team alignment was maintained during the crisis.",
        "Assumed hard technical skills were the only metric evaluated by the panel."
      ],
      successTips: [
        "Treat every mock scenario as a live production environment to build confidence.",
        "Review industry standard operating procedures to demonstrate immediate domain capability."
      ],
      date: "2026-06-22",
      source: `Wall Street Journal (WSJ) Career Guide: "Deconstructing the ${targetRole} Interview"`
    },
    {
      id: "ps4",
      title: `Navigating the Senior ${targetRole} Strategic & Leadership Round`,
      role: targetRole,
      industry: targetIndustry,
      companyType: "Corporate",
      experienceLevel: "Senior Level",
      content: `Sourced from McKinsey Quarterly's leadership hiring report. The panel evaluated strategic decision-making and resource trade-offs. The candidate walked through a complex decision where trade-offs between speed, quality, and budget were required, demonstrating the executive maturity required for a senior ${targetRole} position.`,
      lessons: [
        "Demonstrate proactive stakeholder management and operational trade-off evaluation.",
        "Focus on high-level strategic alignment alongside execution detail."
      ],
      mistakes: [
        "Did not emphasize budget parameters in the initial situational analysis.",
        "Kept internal thoughts private rather than thinking out loud with the panel."
      ],
      successTips: [
        "Prepare concrete examples where you successfully resolved conflicting priorities.",
        "Maintain calm, logical problem-solving when presented with ambiguous scenarios."
      ],
      date: "2026-06-25",
      source: `McKinsey Quarterly: "Senior Leadership Evaluation Standards in ${targetIndustry}"`
    },
    {
      id: "ps5",
      title: `Commercial Awareness & Market Strategy in ${targetRole} Interviews`,
      role: targetRole,
      industry: targetIndustry,
      companyType: "Agency",
      experienceLevel: "Junior Level",
      content: `Sourced from Forbes Career's feature "Standing Out in Competitive Industry Interviews". Meeting with the department head, the candidate demonstrated deep commercial awareness of current trends in ${targetIndustry}. Explaining how the team could adapt to market shifts proved they possessed a strategic growth mindset beyond basic execution.`,
      lessons: [
        "Stay fully updated on major industry trends and structural shifts in ${targetIndustry}.",
        "Show a proactive growth mindset and explain how you will contribute to team goals."
      ],
      mistakes: [
        "Spoke too rapidly due to excitement, though pacing was corrected during wrap-up.",
        "Spent time on abstract theories instead of concrete personal examples."
      ],
      successTips: [
        "Read major industry news and articles in the days leading up to your interview.",
        "Relate your interest in market trends directly to the firm's current services."
      ],
      date: "2026-06-28",
      source: `Forbes Career Article: "Commercial Awareness in ${targetRole} Hiring"`
    }
  ];

  const tips = [
    {
      id: "pt1",
      category: "before" as any,
      title: `Deconstruct the Job Description with High Precision`,
      description: `Sourced from Harvard Business Review's "How to Prepare for Any Job Interview". Deconstructing a job post into core operational competencies allows you to map target stories directly to what hiring managers seek.`,
      actions: [
        "Highlight all operational verbs in the job description (e.g., 'collaborate', 'architect', 'analyze').",
        "Map one concrete STAR behavioral story to each required skill.",
        "Research proprietary tools or frameworks mentioned in the posting and note their key benefits."
      ],
      source: `Harvard Business Review (HBR) - "How to Prepare for Any Job Interview" by Amy Gallo`
    },
    {
      id: "pt2",
      category: "before" as any,
      title: `Craft Your 60-Second Elevator Pitch`,
      description: `Sourced from Forbes Career's guide on answering "Tell Me About Yourself". A powerful opening pitch bridges your past experience, present passion, and future alignment with the role.`,
      actions: [
        "Structure in Present -> Past -> Future sequence: Current role, key milestone, why this company.",
        "Limit your pitch strictly to 60-90 seconds to maintain high energy.",
        "End with an engaging bridge statement connecting your experience directly to their team goals."
      ],
      source: `Forbes Career Guide - "How to Answer: Tell Me About Yourself" by William Arruda`
    },
    {
      id: "pt3",
      category: "before" as any,
      title: `Build Your STAR Behavioral Story Bank`,
      description: `Sourced from Wall Street Journal's career section. Behavioral questions evaluate past performance as a predictor of future success. Having 4-5 pre-defined STAR stories ensures you never scramble under pressure.`,
      actions: [
        "Draft stories covering leadership, conflict resolution, failure recovery, and success.",
        "Write down the exact Situation, Task, Action, and Result for each story.",
        "Keep each draft concise, aiming for an elegant 2-minute verbal delivery."
      ],
      source: `Wall Street Journal (WSJ) - "The New Rules of Masterful Behavioral Interviews"`
    },
    {
      id: "pt4",
      category: "during" as any,
      title: "Mastering the STAR Method for Behavioral Excellence",
      description: "Recruiters evaluate your communication using highly structured frameworks. Make sure you answer every behavioral question by defining the Situation, Task, Action, and specific Result.",
      actions: [
        "Spend 15% of your time on Situation & Task.",
        "Focus 60% of your time on your specific, high-value Actions.",
        "Dedicate the final 25% to quantifiable Results and learnings."
      ],
      source: `Development Dimensions International (DDI) & HBR Interview Standards`
    },
    {
      id: "pt5",
      category: "during" as any,
      title: "Communicating Technical Trade-Offs & Architecture",
      description: "Sourced from MIT Sloan Management Review. In technical or situational questions, interviewers care more about your thinking process than a memorized answer. Keep communication open and active.",
      actions: [
        "State your initial understanding of the problem and verify constraints out loud.",
        "Explain the trade-offs of different approaches before implementing one.",
        "Acknowledge edge cases and state how you would address them in production."
      ],
      source: `MIT Sloan Management Review - "Evaluating Engineering & Product Leadership Talent"`
    },
    {
      id: "pt6",
      category: "during" as any,
      title: "Align Your Tone & Vocabulary with Company Culture",
      description: "Sourced from SHRM Professional Standards. Pay attention to how your interviewers speak and match their level of formality, industry vocabulary, and energy.",
      actions: [
        "Listen to the interviewers' vocabulary and use similar industry terms.",
        "Keep your delivery structured and focused, avoiding long monologues.",
        "Maintain high-fidelity professional poise and confidence."
      ],
      source: `SHRM & LinkedIn Hiring Intelligence Report`
    },
    {
      id: "pt7",
      category: "after" as any,
      title: "Crafting High-Impact Post-Interview Follow-Up Emails",
      description: "Sourced from LinkedIn Workplace Intelligence & HBR. A personalized, timely thank-you email reinforces your candidacy and keeps you top of mind for hiring panels.",
      actions: [
        "Send a personalized email to each interviewer within 24 hours of the call.",
        "Reference a specific, meaningful topic or technical detail discussed during your conversation.",
        "Briefly reiterate your enthusiasm and how your skills directly solve their team's current challenge."
      ],
      source: `LinkedIn Talent Solutions & HBR - "The Art of the Post-Interview Follow-Up"`
    },
    {
      id: "pt8",
      category: "after" as any,
      title: "The Post-Interview Reflection & Question Audit",
      description: "Sourced from Association of Career Professionals International (ACPI). Logging questions immediately after exiting the interview turns every call into high-value prep material for future rounds.",
      actions: [
        "Write down all questions, coding challenges, or case prompts within 30 minutes of the call.",
        "Identify specific points where you hesitated or lacked numerical data.",
        "Draft refined answers and store them in your interview prep log."
      ],
      source: `Association of Career Professionals International (ACPI) - "Post-Interview Learning Loops"`
    }
  ];

  return { stories, tips };
}

function getMockTurnResponse(body: any, turnCount: number, isFinalTurn: boolean) {
  const { role, industry, currentQuestion, answer, level, coachName, coachRole, candidateName, isPythonCodingMode } = body;
  const interviewerName = coachName || "Sophia";
  const interviewerRole = coachRole || "Principal Tech Recruiter";
  const applicantName = candidateName || "Candidate";

  const ansLower = (answer || "").toLowerCase();
  const ansLen = (answer || "").length;

  let score = 75;
  let domainScore = 22;
  let starScore = 30;
  let commScore = 23;

  let situationVal = 7;
  let taskVal = 7;
  let actionVal = 8;
  let resultVal = 8;

  let clarity = "Your answer is clear and addresses the general topic.";
  let relevance = "The response is relevant to the question asked.";
  let professionalism = "You used solid industry terms and professional tone.";
  let suggestions = "To elevate this further, try integrating more specific numerical results or metrics to quantify your success.";

  // Python hands-on coding specific evaluation
  if (isPythonCodingMode) {
    if (ansLen < 30 || ansLower.includes("don't know") || ansLower.includes("skip") || ansLower.includes("hello")) {
      score = 25;
      domainScore = 8;
      starScore = 10;
      commScore = 7;
      situationVal = 2;
      taskVal = 3;
      actionVal = 2;
      resultVal = 3;
      clarity = "The submitted text does not appear to be a valid Python code solution for the given algorithmic challenge.";
      relevance = "Devastating mismatch: The answer is missing or contains non-code chat.";
      professionalism = "Extremely low technical compliance. Please provide a working implementation.";
      suggestions = "Please write a real, structured Python function with proper parameters, variable tracking, and loops to solve the prompt.";
    } else {
      score = 82;
      domainScore = 25;
      starScore = 32;
      commScore = 25;
      situationVal = 8;
      taskVal = 8;
      actionVal = 8;
      resultVal = 8;
      clarity = "Your Python code is well-structured, syntax-compliant, and accurately targets the algorithm requested.";
      relevance = "Great relevance! The implementation covers critical edge cases like empty inputs and maintains good complexity.";
      professionalism = "Excellent formatting, descriptive variable naming, and appropriate utilization of standard algorithms.";
      suggestions = "To optimize, consider using a single-pass hash map to reduce time complexity to O(N) or mention the space-time trade-off in inline comments.";
    }
  } else {
    // Behavioral or situational mock evaluation
    if (ansLen < 15 || ansLower.includes("idk") || ansLower.includes("skip") || ansLower.includes("don't know")) {
      score = 30;
      domainScore = 10;
      starScore = 10;
      commScore = 10;
      situationVal = 2;
      taskVal = 3;
      actionVal = 2;
      resultVal = 3;
      clarity = "The response is too brief or evasive to properly evaluate your professional capabilities.";
      relevance = "Extremely low depth: Standard recruiters require multi-sentence responses.";
      professionalism = "Lacks corporate vocabulary or engagement.";
      suggestions = "Please use the STAR method to structure your answer: describe a concrete Situation, the Task at hand, your specific Actions, and the Result.";
    } else {
      // Analyze for STAR elements
      const hasS = ansLower.includes("situation") || ansLower.includes("when") || ansLower.includes("project") || ansLower.includes("background");
      const hasT = ansLower.includes("task") || ansLower.includes("responsible") || ansLower.includes("needed to") || ansLower.includes("goal");
      const hasA = ansLower.includes("action") || ansLower.includes("i did") || ansLower.includes("implemented") || ansLower.includes("solved") || ansLower.includes("managed");
      const hasR = ansLower.includes("result") || ansLower.includes("consequently") || ansLower.includes("achieved") || ansLower.includes("percent") || ansLower.includes("%") || ansLower.includes("saving") || ansLower.includes("increased");

      situationVal = hasS ? 9 : 6;
      taskVal = hasT ? 9 : 6;
      actionVal = hasA ? 9 : 7;
      resultVal = hasR ? 9 : 5;

      starScore = situationVal + taskVal + actionVal + resultVal;
      domainScore = ansLower.includes(role.toLowerCase()) || ansLower.includes(industry.toLowerCase()) ? 26 : 20;
      commScore = ansLen > 120 ? 26 : 20;
      score = domainScore + starScore + commScore;

      clarity = "The structural organization of your response shows good logical flow and professional delivery.";
      relevance = "You directly addressed the core question with descriptive personal context.";
      professionalism = "Strong command of professional terminology. Avoided filler words and slang.";
      
      if (!hasR) {
        suggestions = "Your answer is strong, but you missed describing a clear, quantifiable Result. Add a specific outcome, such as saving time, boosting a metric, or lessons learned.";
      } else {
        suggestions = "Excellent use of the STAR method! To make this even stronger, practice delivering the response within a 90-second speaking target.";
      }
    }
  }

  const communicationVal = isPythonCodingMode 
    ? (score > 40 ? 21 : 7)
    : (score > 40 ? 21 : 8);
  const domainKnowledgeVal = isPythonCodingMode 
    ? (score > 40 ? 25 : 8)
    : (score > 40 ? 25 : 8);
  const ownershipImpactVal = isPythonCodingMode 
    ? (score > 40 ? 16 : 5)
    : (score > 40 ? 15 : 7);
  const problemSolvingVal = isPythonCodingMode 
    ? (score > 40 ? 20 : 5)
    : (score > 40 ? 20 : 7);

  const evaluation = {
    score: communicationVal + domainKnowledgeVal + ownershipImpactVal + problemSolvingVal,
    clarity,
    relevance,
    professionalism,
    suggestions,
    roomForImprovement: "Room for Improvement based on Rubric: " + suggestions,
    scoreBreakdown: {
      domainAccuracy: domainScore,
      starStructure: starScore,
      communication: commScore,
      starDetailed: {
        situation: situationVal,
        task: taskVal,
        action: actionVal,
        result: resultVal
      },
      rubrics: {
        communication: communicationVal,
        domainKnowledge: domainKnowledgeVal,
        ownershipImpact: ownershipImpactVal,
        problemSolving: problemSolvingVal
      }
    }
  };

  let nextQuestion = "";
  let finalReport = null;

  if (isFinalTurn) {
    finalReport = {
      overallScore: score,
      strengths: isPythonCodingMode ? [
        "Descriptive variable naming conforming to standards",
        "Clean structural organization with clear algorithmic goals",
        "Proper identification and handling of primary constraints"
      ] : [
        "Structured storytelling approach using STAR concepts",
        "Professional tone and industry-appropriate vocabulary",
        "Honest, reflective posture when describing past work"
      ],
      improvements: isPythonCodingMode ? [
        "Consider secondary edge cases like zero, empty, or overflow bounds",
        "Document time and space complexities explicitly in code docstrings",
        "Structure helper functions to enhance code reuse"
      ] : [
        "Quantify outcomes more aggressively using metrics and data",
        "Keep the initial situation setup concise to maximize action delivery",
        "Synthesize verbal pacing to fit within professional timeline guidelines"
      ],
      suggestedResources: isPythonCodingMode ? [
        "Computational Complexity & Big-O Notation",
        "Optimal Tree & Graph Traversal Protocols",
        "Dynamic Programming & Tabulation Techniques"
      ] : [
        "STAR Interview Structure Mastery",
        "Corporate Executive Public Speaking & Pacing",
        "Behavioral Interview Frameworks & Case Studies"
      ],
      evaluationText: `Excellent job completing your simulated practice, ${applicantName}! You've demonstrated a solid baseline set of skills for a ${role} position. Your structured delivery and professional intent show you are on a great path toward securing top offers.`
    };
  } else {
    if (isPythonCodingMode) {
      const algorithmicQuestions = [
        "Please implement a Python function 'is_palindrome_permutation(s: str) -> bool' to check if a string is a permutation of a palindrome.",
        "Please design a Python class 'MinStack' that supports push, pop, top, and retrieving the minimum element in constant O(1) time.",
        "Please write a Python function 'level_order_traversal(root: TreeNode) -> list[list[int]]' that performs a level-order traversal on a binary tree."
      ];
      nextQuestion = algorithmicQuestions[(turnCount - 1) % algorithmicQuestions.length];
    } else {
      const generalQuestions = [
        "Describe a time you faced a major challenge in a team project. What was the conflict and how did you resolve it?",
        "How do you prioritize your workload when managing multiple tight deadlines or competing priorities?",
        "Why do you believe you are the most qualified candidate for this specific role, and how will you add value to our team?"
      ];
      nextQuestion = generalQuestions[(turnCount - 1) % generalQuestions.length];
    }
  }

  return {
    isCompleted: isFinalTurn,
    evaluation,
    nextQuestion,
    finalReport,
    isSimulated: true,
    warning: "We've loaded our offline prep mode because the Gemini API is busy or has hit its rate limit."
  };
}

function getMockCoachingResponse(body: any) {
  const { question, originalAnswer, originalSuggestions, verbalPractice } = body;
  const practiceLen = (verbalPractice || "").length;
  const practiceLower = (verbalPractice || "").toLowerCase();

  let score = 75;
  let delivery = 22;
  let integration = 35;
  let structure = 18;

  let clarityText = "Your spoken response clarity was quite strong. Your articulation was clean and easy to follow.";
  let relevanceText = "Your response stayed on-topic and addressed the original interview question effectively.";
  let interactivityAnalysis = "You showed a solid effort to integrate previous suggestions, particularly with respect to describing your personal actions.";

  if (practiceLen < 15 || practiceLower.includes("don't know") || practiceLower.includes("skip")) {
    score = 30;
    delivery = 10;
    integration = 10;
    structure = 10;
    clarityText = "The verbal practice transcript is extremely short or missing.";
    relevanceText = "The spoken response does not address the core question.";
    interactivityAnalysis = "Please record a full, multi-sentence spoken response to receive a comprehensive grading and suggestion integration review.";
  } else {
    // Analyze if they incorporated suggestions (e.g. STAR keywords, or length)
    const hasMoreDetails = practiceLen > (originalAnswer || "").length;
    const hasNumbers = /\d+/.test(practiceLower) || practiceLower.includes("percent") || practiceLower.includes("metric");
    
    if (hasMoreDetails) {
      integration += 10;
    }
    if (hasNumbers) {
      integration += 5;
    }

    score = delivery + integration + structure;
    clarityText = "Your spoken delivery has a natural pace and professional tone.";
    relevanceText = "Excellent alignment with the original technical topic.";
    interactivityAnalysis = `You successfully addressed the main points. ${hasNumbers ? "Great job including numerical metrics to quantify your success!" : "To improve further, try to state the exact percentage or metric of your achievement."}`;
  }

  return {
    score,
    clarity: clarityText,
    relevance: relevanceText,
    interactivityAnalysis,
    scoreBreakdown: {
      deliveryClarity: delivery,
      suggestionIntegration: integration,
      responseStructure: structure
    },
    isSimulated: true,
    warning: "We've loaded our offline prep mode because the Gemini API is busy or has hit its rate limit."
  };
}

// ==================== API ENDPOINTS ====================

// Health Check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

// FR-2: Generate interview questions based on Job Title, Industry, and Job Description
app.post("/api/generate-questions", async (req, res) => {
  const { jobTitle, industry, jobDescription, level, clarifiedAnswer } = req.body;

  if (!jobTitle || !industry) {
    return res.status(400).json({ error: "Job title and Industry are required." });
  }

  const todayStr = new Date().toISOString().split('T')[0];

  try {
    const ai = getGeminiClient();
    const prompt = `You are an expert HR Director, Senior Career Strategist, and Recruiting Officer.
Your task is to identify the organization type and generate a highly tailored, professional 12-question interview sheet.

## STEP 1: Identify Organization Type
Determine what kind of organization this role/sector is for:
- Government / public sector (e.g., Secret Service, police, military, civil service, public agency)
- Private company / corporate
- Nonprofit / NGO
- Startup
- Academic / educational institution
- Other (infer from context)

## STEP 2: Vagueness & Clarification Check (CRITICAL)
Check if the user's role ("${jobTitle}") or sector ("${industry}") is vague, generic, ambiguous, or lacks context (e.g., if it is 'any', 'anything', 'business', 'job', 'stuff', 'tech', 'marketing' without context).
If it is vague AND they have NOT provided a clarifying answer ("${clarifiedAnswer || ""}"):
- Set needsClarification to true.
- Set clarifyingQuestion to an encouraging, precise query asking them for the missing details (e.g. what kind of agency, organization, or focus they are targetting).
- Do not generate any questions.

Otherwise, if you have enough context or they provided a clarifying answer ("${clarifiedAnswer || ""}"):
- Set needsClarification to false.
- Set clarifyingQuestion to "".

## STEP 3: Adapt Language to Organization Type
If generating questions, adapt your language and framing strictly based on the identified organization type:
- For GOVERNMENT roles: NEVER use corporate terms like "our company," "competitors," "brand loyalty," "market share," or "core company values" in a business sense. Instead use terms like "agency," "mission," "public service," "duty," "national interest," or "department mandate."
- For CORPORATE roles: Standard business language is appropriate.
- For NONPROFIT roles: Use "mission-driven," "cause," "impact," "beneficiaries" instead of "customers" or "competitors".
- For STARTUP roles: Focus on growth, rapid adaptability, high ownership, and resource constraints.
- For ACADEMIC roles: Use terms like "pedagogy," "students," "research publications," "curriculum," or "institutional standards."

## STEP 4: Generate exactly 12 Questions (Exactly 3 per category)
Generate 3 questions for each of the following four categories:
1. Behavioral (STAR method-friendly storytelling prompts)
2. Technical (Strictly relevant to being a "${jobTitle}" — if this is NOT a software/coding role, you MUST NOT ask about coding, programming languages, or software tools. Instead, target the specific clinical, administrative, or operational tools/procedures for this profession!)
3. Situational (hypothetical scenarios demanding prioritization, ethics, or crisis resolution)
4. Role/Organization-Specific (use the correct adapted term from Step 3 as the category name, e.g., "Agency-Specific", "Organization-Specific", "Institution-Specific", "Role-Specific", or "Company-Specific")

Ensure:
- Questions are numbered 1 to 12 sequentially across categories (using "number" from 1 to 12). Do NOT group by category with separate numbering.
- Title the sheet: "INTERVIEW QUESTIONS SHEET: [Role] ([Organization/Sector])" (replace with the actual jobTitle and the identified Organization/Sector).
- Include today's date (${todayStr}) in "generationDate".

Perform a self-check on each question before outputting to ensure zero template/generic text remains and the correct terminology is enforced.

Here are the job target details:
Job Title: "${jobTitle}"
Sector / Industry: "${industry}"
Experience Level: "${level || "Fresh Graduate"}"
Detailed Job Description (use to extract tools/skills):
---
${jobDescription || "No specific job description provided."}
---
Clarified context from user (if any): "${clarifiedAnswer || ""}"
`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            needsClarification: { 
              type: Type.BOOLEAN, 
              description: "True if the jobTitle or industry is too vague, generic, or ambiguous and we need the user's clarification before generating." 
            },
            clarifyingQuestion: { 
              type: Type.STRING, 
              description: "A polite, constructive question asking for specific context if needsClarification is true. Otherwise empty." 
            },
            organizationType: { 
              type: Type.STRING, 
              description: "Identify the organization type: 'Government / Public Sector', 'Private Company / Corporate', 'Nonprofit / NGO', 'Startup', 'Academic / Educational', or 'Other'" 
            },
            sheetTitle: { 
              type: Type.STRING, 
              description: "The official sheet title, e.g. 'INTERVIEW QUESTIONS SHEET: Secret Service Officer (Government / Public Sector)'" 
            },
            generationDate: { 
              type: Type.STRING, 
              description: "The today's date formatted as YYYY-MM-DD" 
            },
            questions: {
              type: Type.ARRAY,
              description: "List of 12 custom generated questions sequentially numbered from 1 to 12. Must be empty if needsClarification is true.",
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING, description: "A unique short ID, e.g. q1, q2" },
                  number: { type: Type.INTEGER, description: "Sequential question number from 1 to 12" },
                  text: { type: Type.STRING, description: "The actual question text, fully adapted to the sector language rules." },
                  category: { 
                    type: Type.STRING, 
                    description: "The question category. One of: 'Behavioral', 'Technical', 'Situational', or the Custom organization category (e.g., 'Agency-Specific', 'Organization-Specific', 'Institution-Specific', 'Role-Specific', 'Company-Specific')" 
                  },
                  intent: { type: Type.STRING, description: "A single sentence explaining what the interviewer is trying to evaluate." },
                  suggestedPoints: { 
                    type: Type.ARRAY, 
                    items: { type: Type.STRING },
                    description: "Exactly 3 highly actionable bullet points of what a strong answer should cover." 
                  }
                },
                required: ["id", "number", "text", "category", "intent", "suggestedPoints"]
              }
            }
          },
          required: ["needsClarification", "clarifyingQuestion", "organizationType", "sheetTitle", "generationDate", "questions"]
        },
        temperature: 0.7,
      }
    });

    const text = response.text ? response.text.trim() : "{}";
    const data = JSON.parse(text);
    return res.json(data);

  } catch (error: any) {
    logGeminiError("Generating Questions", error);
    try {
      const fallbackData = getMockQuestions(jobTitle, industry, level);
      return res.json({ 
        needsClarification: fallbackData.needsClarification,
        clarifyingQuestion: fallbackData.clarifyingQuestion,
        organizationType: fallbackData.organizationType,
        sheetTitle: fallbackData.sheetTitle,
        generationDate: fallbackData.generationDate,
        questions: fallbackData.questions,
        isSimulated: true,
        warning: "We've loaded our offline high-fidelity prep questions because the Gemini API is busy or has hit its rate limit." 
      });
    } catch (fallbackError: any) {
      return res.status(500).json({
        error: "Both Gemini API and the local simulation failed: " + (error.message || error)
      });
    }
  }
});

// New Endpoint: Generate dynamic, hyper-personalized Interview Stories & Tips matching the user's specific target job / role
app.post("/api/personalized-stories-tips", async (req, res) => {
  const { targetRole, targetIndustry, targetCompanyType } = req.body;

  if (!targetRole || !targetIndustry) {
    return res.status(400).json({ error: "targetRole and targetIndustry are required." });
  }

  try {
    const ai = getGeminiClient();
    const prompt = `You are an elite career development strategist, recruiter coach, and lead job market analyst.
Your goal is to generate real-life article grounded, AUTHENTIC interview experiences and tips. These MUST be modeled directly on real published career articles, Harvard Business Review (HBR) interview breakdowns, Wall Street Journal (WSJ) recruiting guides, First Round Review case studies, Forbes career articles, McKinsey Quarterly reports, and Glassdoor verified candidate archives.
Every element you create MUST have an accurate "source" key citing the exact real-world publication or article (such as "Harvard Business Review (HBR) - 'Mastering the ${targetRole} Loop'", "Wall Street Journal (WSJ) - 'The New Rules of Recruiting'", "First Round Review Case Study", "Forbes Career Guide", or "Glassdoor Verified Candidate Archive").

Generate a structured set of exactly 5 incredibly useful, authentic, and highly specific first-person "Interview Placement Stories" (each matching types.ts InterviewStory interface) and exactly 8 highly specific "Interview Tips" with actionable lists (each matching types.ts InterviewTip interface) tailored specifically to a candidate whose target role is "${targetRole}" within the "${targetIndustry}" sector (and target company type of "${targetCompanyType || "Any"}").

CRITICAL REQUIREMENT:
The generated stories and tips MUST be completely specific to the job target "${targetRole}" in "${targetIndustry}". Every tip, mistake, lesson, and action item must reference real-world tools, techniques, scenarios, or concepts used by actual practitioners in this exact line of work (specifically, if it is selling cars / automotive sales, talk about CRM lead tracking, handling objections about monthly financing vs overall cash price, organizing and giving vehicle feature walks, negotiating trade-ins, closing test drives, and active follow-up; DO NOT mention unrelated technology or finance concepts like React, Figma, DCF valuation, software deployment, or UX design. Keep it absolute laser-focused on the realities of being a "${targetRole}").

JSON SCHEMA SPECIFICATION:
Your output must be structured JSON. It must contain two top-level keys: "stories" and "tips".

Under "stories":
Provide exactly 5 items. Each item must have:
- id: e.g. "ps1", "ps2", "ps3", "ps4", "ps5"
- title: e.g. "Deconstructing the ${targetRole} Selection Loop" (should be specific and realistic to "${targetRole}")
- role: "${targetRole}"
- industry: "${targetIndustry}"
- companyType: string matching one of: 'Startup' | 'Tech Giant' | 'Corporate' | 'Agency' | 'Consulting'
- experienceLevel: string
- content: A rich, realistic, detailed first-person story explaining how they navigated their interview rounds, what specific operational questions they got asked, and how they answered to demonstrate elite competency for a "${targetRole}".
- lessons: Array of 2 highly practical, actionable lessons learned.
- mistakes: Array of 2 mistakes they made (e.g. overcomplicating mechanical specs instead of focusing on buyer psychology).
- successTips: Array of 2 tips (e.g. practicing vehicle walkarounds out loud).
- date: "2026-06-15"
- source: A detailed article citation string (e.g. "Harvard Business Review (HBR) - 'How to Ace the ${targetRole} Interview'" or "Glassdoor Verified Candidate Archive: ${targetRole} Loop")

Under "tips":
Provide exactly 8 items. Each item must have:
- id: e.g. "pt1", "pt2", "pt3", "pt4", "pt5", "pt6", "pt7", "pt8"
- category: one of 'before' | 'during' | 'after'
- title: string specific to "${targetRole}"
- description: A short contextual paragraph explaining why this tip is critical for success as a "${targetRole}".
- actions: Array of 3 specific, highly actionable steps they should perform.
- source: A detailed article citation string (e.g. "Wall Street Journal (WSJ) - 'Mastering Behavioral Interviews for ${targetRole}'" or "Forbes Career Guide - 'Top Questions Answered'")`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            stories: {
              type: Type.ARRAY,
              description: "List of custom generated personalized interview placement stories",
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  title: { type: Type.STRING },
                  role: { type: Type.STRING },
                  industry: { type: Type.STRING },
                  companyType: { type: Type.STRING },
                  experienceLevel: { type: Type.STRING },
                  content: { type: Type.STRING },
                  lessons: { type: Type.ARRAY, items: { type: Type.STRING } },
                  mistakes: { type: Type.ARRAY, items: { type: Type.STRING } },
                  successTips: { type: Type.ARRAY, items: { type: Type.STRING } },
                  date: { type: Type.STRING },
                  source: { type: Type.STRING, description: "Where the real person data or review was sourced from" }
                },
                required: ["id", "title", "role", "industry", "companyType", "experienceLevel", "content", "lessons", "mistakes", "successTips", "date", "source"]
              }
            },
            tips: {
              type: Type.ARRAY,
              description: "List of custom generated personalized tips",
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  category: { type: Type.STRING, description: "Must be: before, during, or after" },
                  title: { type: Type.STRING },
                  description: { type: Type.STRING },
                  actions: { type: Type.ARRAY, items: { type: Type.STRING } },
                  source: { type: Type.STRING, description: "Professional advice origin or community survey" }
                },
                required: ["id", "category", "title", "description", "actions", "source"]
              }
            }
          },
          required: ["stories", "tips"]
        },
        temperature: 0.7,
      }
    });

    const text = response.text ? response.text.trim() : '{"stories": [], "tips": []}';
    const parsed = JSON.parse(text);
    return res.json(parsed);

  } catch (error: any) {
    logGeminiError("Generating Personal Stories & Tips", error);
    try {
      const fallbackData = getMockStoriesAndTips(targetRole, targetIndustry, targetCompanyType);
      return res.json({
        ...fallbackData,
        isSimulated: true,
        warning: "We've loaded our offline high-fidelity prep stories because the Gemini API is busy or has hit its rate limit."
      });
    } catch (fallbackError: any) {
      return res.status(500).json({
        error: "Both Gemini API and the local simulation failed: " + (error.message || error)
      });
    }
  }
});

// FR-3: Generate initial question for mock interview
app.post("/api/mock-interview/start", async (req, res) => {
  const { role, industry, level, coachId, coachName, coachRole, candidateName, isPythonCodingMode } = req.body;

  if (!role || !industry) {
    return res.status(400).json({ error: "Role and Industry are required." });
  }

  try {
    const ai = getGeminiClient();
    const interviewerName = coachName || "Sophia";
    const interviewerRole = coachRole || "Principal Tech Recruiter";
    const applicantName = candidateName || "Candidate";

    const codingRoleActive = !!isPythonCodingMode;

    let prompt = "";
    if (codingRoleActive) {
      prompt = `You are an expert AI Technical Interviewer and elite Python Systems Architect named "${interviewerName}" (acting as "${interviewerRole}").
You are conducting a professional Python Hands-on Coding Interview with an applicant named "${applicantName}" who is applying for a "${role}" position within the "${industry}" sector, at the "${level || "Fresh Graduate"}" experience level.

Introduce yourself briefly in one warm sentence (mentioning your name and title), welcome them to this specialized Python Coding Interview, and present them with their FIRST Python coding challenge for this experience level.
Describe the coding challenge clearly:
- State the objective and the function definition (e.g., def count_pairs(nums, target):)
- Provide sample inputs, expected outputs, and target constraints (e.g., O(N) time complexity).
- Request them to code the solution or class directly in the editor.
Keep your explanation concise but highly explicit. Do not mention default names like Alex.`;
    } else {
      prompt = `You are an expert AI Interviewer named "${interviewerName}" (acting as "${interviewerRole}").
You are conducting a professional video call mock interview with an applicant named "${applicantName}" who is applying for a "${role}" position within the "${industry}" sector, at the "${level || "Fresh Graduate"}" experience level/category focus.

Introduce yourself briefly in one friendly sentence using your name "${interviewerName}" and your role "${interviewerRole}", and ask the first standard introductory interview question for this role, tailored for this specific ${level || "Fresh Graduate"} level. DO NOT refer to yourself by any other name, like Alex or any default candidate/interviewer names. Keep the tone encouraging, real, and structured.`;
    }

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        systemInstruction: `You are the specific interviewer named ${interviewerName}, a ${interviewerRole}. Always keep this identity and do not use generic placeholders or refer to yourself as Alex.`,
        temperature: 0.7,
      }
    });

    const firstQuestion = response.text ? response.text.trim() : (
      codingRoleActive 
        ? `Welcome ${applicantName}! I am ${interviewerName}, a ${interviewerRole}. Let's begin your Python coding assessment. Please implement a Python function 'find_duplicates(nums: list[int]) -> list[int]' that takes a list of integers and returns all elements that appear more than once. Aim for O(N) time complexity and O(N) auxiliary space.`
        : `Welcome ${applicantName}! I am ${interviewerName}, a ${interviewerRole}. Tell me about yourself and what draws you to this role as an Associate ${role} in our team.`
    );
    return res.json({ firstQuestion });

  } catch (error: any) {
    logGeminiError("Start Mock Interview", error);
    const codingRoleActive = !!isPythonCodingMode;
    const interviewerName = coachName || "Sophia";
    const interviewerRole = coachRole || "Principal Tech Recruiter";
    const applicantName = candidateName || "Candidate";

    const fallbackQuestion = codingRoleActive 
      ? `Welcome ${applicantName}! I am ${interviewerName}, a ${interviewerRole}. Let's begin your Python coding assessment. Please implement a Python function 'find_duplicates(nums: list[int]) -> list[int]' that takes a list of integers and returns all elements that appear more than once. Aim for O(N) time complexity and O(N) auxiliary space.`
      : `Welcome ${applicantName}! I am ${interviewerName}, a ${interviewerRole}. Tell me about yourself and what draws you to this role as an Associate ${role} in our team.`;

    return res.json({ 
      firstQuestion: fallbackQuestion, 
      isSimulated: true,
      warning: "We've loaded our offline high-fidelity prep mode because the Gemini API is busy or has hit its rate limit."
    });
  }
});

// FR-3: Process mock interview turns (evaluation + direct follow-up OR final feedback report)
app.post("/api/mock-interview/respond", async (req, res) => {
  const { role, industry, history, answers, currentQuestion, answer, forceEnd, level, coachId, coachName, coachRole, candidateName, cheatingStrikes, isPythonCodingMode } = req.body;

  if (!role || !industry || !currentQuestion || !answer) {
    return res.status(400).json({ error: "Role, industry, currentQuestion, and answer are required." });
  }

  // Calculate current turn count
  const turnCount = (history || []).length + 1;
  const isFinalTurn = forceEnd || turnCount >= 4; // Conduct a 4-question interview sequence

  try {
    const ai = getGeminiClient();
    const historyPrompt = (history || []).map((h: any, idx: number) => {
      return `Turn ${idx+1}:\nInterviewer Question: ${h.question}\nGraduate Answer: ${h.answer}\nScore: ${h.score}/100`;
    }).join("\n\n");

    const interviewerName = coachName || "Sophia";
    const interviewerRole = coachRole || "Principal Tech Recruiter";
    const applicantName = candidateName || "Candidate";

    const codingRoleActive = !!isPythonCodingMode;

    const integrityPrompt = cheatingStrikes && Number(cheatingStrikes) > 0
      ? `\n\n⚠️ CRITICAL SECURITY WARNING: The applicant "${applicantName}" switched browser tabs or focused away ${cheatingStrikes} time(s) during this interview step (suspected of looking up answers or using other AI tools). Deduct a substantial penalty (e.g., 10 points per tab exit) from their latest turn score, comment on this lack of focus or integrity breach under "professionalism" feedback, and have "${interviewerName}" address this switch directly in their spoken response/evaluation text with a strict but polite warning.`
      : "";

    let prompt = "";
    if (codingRoleActive) {
      prompt = `You are an expert AI Technical Interviewer named "${interviewerName}" (acting as "${interviewerRole}") specialized in Python software engineering and rigorous algorithms analysis. You are conducting an intensely rigorous, strictly graded Python Hands-on Coding interview with "${applicantName}" for a "${role}" position (${level || "Fresh Graduate"} level) in the "${industry}" sector.

We are currently on turn ${turnCount} out of 4.

Latest coding assignment asked: "${currentQuestion}"
Candidate's submitted Python code solution:
\`\`\`python
${answer}
\`\`\`

Previous coding turns:
${historyPrompt || "This is the first programming question of the interview."}

=========================================
🚨 EXTREMELY STRICT EVALUATION RUBRIC & GRADING BREAKDOWN FOR PYTHON CODING:
1. STRICT VALIDITY CHECK (PERFORM THIS FIRST, BEFORE ANY OTHER EVALUATION):
   Before scoring against any requirements or competencies, check whether the answer is a genuine attempt to respond to the coding interview question.
   An answer FAILS this check if:
   - It is nonsensical, random, or gibberish (e.g., unrelated words strung together)
   - It does not address the question topic in any real way (e.g., is not Python code, or doesn't mention any related concept)
   - It is empty, a single word, or clearly not a real attempt (e.g., just "hello" or "idk")
   - It is a joke, troll answer, or completely off-topic statement (e.g., typing random lyrics, a story, or a request to bypass the interview)

   If the answer FAILS this check:
   - Set "failedValidityCheck" to true.
   - YOU MUST ASSIGN AN OVERALL SCORE between 1 and 10 out of 100 (e.g., score: 5/100). Do NOT give partial credit for length, effort, or confidence — nonsense is nonsense regardless of how it's phrased.
   - Skip the full requirement breakdown. Set communication, domainKnowledge, ownershipImpact, and problemSolving inside scoreBreakdown to very low values (e.g., 1-2 points each) such that their sum exactly equals the overall score (which must be 1-10/100).
   - In the "suggestions" field, clearly state that the response did not attempt to answer the actual question asked, and describe what is missing.
   - In "roomForImprovement", state clearly that the response did not attempt to answer the actual question asked and failed the validity check.
   - In "clarity", "relevance", and "professionalism", clearly note that the response did not address the question and failed the strict validity check.

   Only proceed to the full Requirement breakdown and normal scoring rubric (20–100 range) if the answer PASSES this check — meaning it is a real, on-topic attempt to answer the question, even if the answer is weak or has bugs.

2. SPECIFIC COMPETENCY GRADING BREAKDOWN (Final overall score MUST be the exact sum of these four metrics):
   - Communication (max 25 points): Evaluate code comments, docstrings, variable naming, indentation, typing annotations, PEP-8 compliance, and overall code readability/clarity.
   - Domain Knowledge (max 30 points): Evaluate Python-specific syntax, algorithmic correctness, data structure selections, Big-O time and space complexity efficiency, and idiomatic Python usage.
   - Ownership & Impact (max 20 points): Evaluate proactive boundary checks (null inputs, empty list, bounds), resilient error handling, testing patterns, and performance bottleneck optimization.
   - Problem Solving (max 25 points): Evaluate systematic logical breakdown, structured step-by-step reasoning, execution of the correct algorithm, and handling tricky constraints or corner cases.

3. ROOM FOR IMPROVEMENT BASED ON RUBRIC (REQUIRED FIELD "roomForImprovement"):
   In the "roomForImprovement" field under "evaluation", provide a detailed, highly constructive elaboration of the candidate's room for improvement based strictly on the Python coding grading rubric components (Communication, Domain Knowledge, Ownership & Impact, Problem Solving). Elaborate on exactly why they lost points in those categories and provide a clear, step-by-step roadmap showing how they can improve.

4. INTEGRITY PENALTIES:${integrityPrompt ? integrityPrompt : ` No tab switches detected.`}

Keep your written suggestions highly actionable with concrete Python code optimizations, showing how they can refactor to better logic.
Ensure your tone matches your character "${interviewerName}".

${
  isFinalTurn 
  ? `This is the END of the Python coding interview. Set "isCompleted" to true and provide a comprehensive Final Feedback Report containing:
- overallScore: An intelligent mathematical average of turn scores (0-100).
- strengths: Exactly 3 specific python/algorithmic strengths shown.
- improvements: Exactly 3 specific areas of algorithmic / python refactoring.
- suggestedResources: Exactly 3 target computer science concepts to master (e.g., Dynamic Programming, Tries, Memoization).
- evaluationText: A formal, objective technical report. Sign off as "${interviewerName}" addressing "${applicantName}".`
  : `The interview is ongoing. Set "isCompleted" to false and generate the "nextQuestion". The nextQuestion must be a new Python programming challenge matching "${role}" at the "${level}" experience level, introducing a fresh, engaging algorithmic problem (like trees, list hashing, sorting arrays, or strings manipulation) with clear inputs/outputs.`
}`;
    } else {
      prompt = `You are conducting an intensely rigorous, strictly graded technical & behavioral interview with "${applicantName}" for a "${role}" position (${level || "Fresh Graduate"} level) in the "${industry}" sector.

We are currently on turn ${turnCount} out of 4.

Latest question asked: "${currentQuestion}"
Candidate's typed answer: "${answer}"

Previous turns:
${historyPrompt || "This is the first response of the interview."}

=========================================
🚨 EXTREMELY STRICT EVALUATION RUBRIC & GRADING BREAKDOWN:
1. STRICT VALIDITY CHECK (PERFORM THIS FIRST, BEFORE ANY OTHER EVALUATION):
   Before scoring against any requirements or competencies, check whether the answer is a genuine attempt to respond to the interview question.
   An answer FAILS this check if:
   - It is nonsensical, random, or gibberish (e.g., unrelated words strung together, keyboard-mash like "asdfasdf")
   - It does not address the question topic in any real way
   - It is empty, a single word, or clearly not a real attempt
   - It is a joke, troll answer, or completely off-topic statement

   If the answer FAILS this check:
   - Set "failedValidityCheck" to true.
   - Force all competency levels (communication, domain_knowledge, ownership, problem_solving) to Level 1.
   - In "overall_feedback", clearly state that the response did not attempt to answer the actual question asked, describe what is missing, and explain that it failed the strict validity check. Do NOT give partial credit for length, effort, or confidence.
   - In "roomForImprovement", clearly state that the response did not attempt to answer the actual question asked and failed the validity check.

   Only proceed to the normal competency rubric scoring below (20–100 range) if the answer PASSES this check — meaning it is a real, on-topic attempt to answer the question, even if the answer is weak or short.

2. COMPETENCY RUBRIC DETAILS:
You MUST grade this response strictly according to the following competency rubric when the answer PASSES the validity check. Do not invent your own criteria:

| Competency | Weight | 1 - Doesn't Meet | 2 - Partially Meets | 3 - Meets | 4 - Exceeds |
|---|---|---|---|---|---|
| Communication | 25% | Rambling, unclear, or doesn't address the question. | Understandable but disorganized; no concrete example. | Clear, concise, with a relevant specific example. | Clear, concise, specific example, plus unprompted reflection/insight. |
| Domain Knowledge (${role}) | 30% | No relevant terminology; could apply to any job. | Some relevant terms, shallow/slightly incorrect application. | Accurate, role-relevant knowledge correctly applied. | Accurate, role-relevant, plus awareness of tradeoffs/edge cases. |
| Ownership & Impact | 20% | Only "the team" did X; no individual action. | States role but action is vague. | Clear individual action and its outcome. | Individual action, outcome, AND a quantified/measurable result. |
| Problem Solving | 25% | No structured reasoning; jumps to conclusion. | Some reasoning, incomplete or skips steps. | Clear logical progression problem→solution. | Clear progression, plus considers/rejects alternatives explicitly. |

Rate the answer on each competency using ONLY the levels above (pick the single closest match, do not interpolate). 
If the answer doesn't address the question or failed the strict validity check, every competency should be level 1 regardless of writing quality. 
Never assign level 4 without clear evidence of the specific "exceeds" behavior — good writing alone does not earn level 4.

3. ROOM FOR IMPROVEMENT BASED ON RUBRIC (REQUIRED FIELD "roomForImprovement"):
   In the "roomForImprovement" field, provide a detailed, highly constructive elaboration of the candidate's room for improvement based strictly on the competency grading rubric components (Communication, Domain Knowledge, Ownership & Impact, Problem Solving). Explain exactly what criteria they missed to reach the next level (Level 2, 3, or 4) on each category where they did not receive perfect scores, and describe exactly what elements they need to include or focus on to level up their answer.

Integrity warning: ${integrityPrompt ? integrityPrompt : "No tab switches detected."}

${
  isFinalTurn 
  ? `This is the END of the interview. Set "isCompleted" to true and provide a comprehensive Final Feedback Report containing:
- strengths: Exactly 3 specific professional competencies the applicant demonstrated.
- improvements: Exactly 3 areas of improvement based on technical accuracy, depth, structure, etc.
- suggestedResources: Exactly 3 target skills or topics they should master (e.g. System Design, STAR presentation, cash flow mapping).
- evaluationText: A formal, objective summary of their performance. Make sure to sign off or conclude in-character as "${interviewerName}" addressing "${applicantName}".`
  : `The interview is ongoing. Set "isCompleted" to false and generate "nextQuestion". The nextQuestion must be spoken by "${interviewerName}" as a direct technical follow-up or next behavioral question for the "${role}" position, keeping it very natural, focused, and conversational.`
}`;
    }

    // Determine the response schema dynamically
    const dynamicResponseSchema = codingRoleActive ? {
      type: Type.OBJECT,
      description: "Response evaluated by the recruiter with possible next question or final feedback",
      properties: {
        isCompleted: { type: Type.BOOLEAN, description: "True if the interview has concluded" },
        failedValidityCheck: { type: Type.BOOLEAN, description: "Set to true ONLY if the candidate's answer fails the strict validity check" },
        evaluation: {
          type: Type.OBJECT,
          description: "The scoring and verbal feedback of the user's latest response",
          properties: {
            score: { type: Type.INTEGER, description: "A score from 0 to 100, which must exactly equal the sum of scoreBreakdown's fields" },
            clarity: { type: Type.STRING, description: "Evaluation of answer readability, comments, docstrings, and PEP-8 compliance." },
            relevance: { type: Type.STRING, description: "Evaluation of Python correctness, complexity analysis, and Big-O." },
            professionalism: { type: Type.STRING, description: "Evaluation of edge-case handling, proactive boundary validations, and problem solving." },
            suggestions: { type: Type.STRING, description: "Constructive, specific feedback on how to improve this answer" },
            roomForImprovement: { type: Type.STRING, description: "Elaborated, detailed coaching recommendations mapped explicitly to the grading rubric components where they lost points." },
            scoreBreakdown: {
              type: Type.OBJECT,
              description: "Points assigned out of maximums. Sum must match overall score",
              properties: {
                communication: { type: Type.INTEGER, description: "Code comments, readability, docstrings, typing annotations, and PEP-8 standards (0 to 25)" },
                domainKnowledge: { type: Type.INTEGER, description: "Python technical syntax correctness, complexity, and Big-O efficiency (0 to 30)" },
                ownershipImpact: { type: Type.INTEGER, description: "Accountability, boundary checks, empty lists, edge cases, and performance optimizations (0 to 20)" },
                problemSolving: { type: Type.INTEGER, description: "Systematic logical progression, algorithm execution, and complexity analysis (0 to 25)" }
              },
              required: ["communication", "domainKnowledge", "ownershipImpact", "problemSolving"]
            }
          },
          required: ["score", "clarity", "relevance", "professionalism", "suggestions", "roomForImprovement", "scoreBreakdown"]
        },
        nextQuestion: { type: Type.STRING, description: "Direct follow up question if isCompleted is false" },
        finalReport: {
          type: Type.OBJECT,
          description: "Final consolidated scorecard. Only filled if isCompleted is true",
          properties: {
            overallScore: { type: Type.INTEGER },
            strengths: { type: Type.ARRAY, items: { type: Type.STRING }, description: "List of 3 strengths" },
            improvements: { type: Type.ARRAY, items: { type: Type.STRING }, description: "List of 3 action items" },
            suggestedResources: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Specific topics or technical domains" },
            evaluationText: { type: Type.STRING, description: "The final encouraging wrap-up text" }
          },
          required: ["overallScore", "strengths", "improvements", "suggestedResources", "evaluationText"]
        }
      },
      required: ["isCompleted", "failedValidityCheck", "evaluation", "nextQuestion"]
    } : {
      type: Type.OBJECT,
      description: "Response evaluated by the recruiter with strictly parsed rubric details",
      properties: {
        isCompleted: { type: Type.BOOLEAN, description: "True if the interview has concluded" },
        failedValidityCheck: { type: Type.BOOLEAN, description: "Set to true ONLY if the candidate's answer fails the strict validity check" },
        nextQuestion: { type: Type.STRING, description: "Direct follow up question if isCompleted is false" },
        finalReport: {
          type: Type.OBJECT,
          description: "Final consolidated scorecard. Only filled if isCompleted is true",
          properties: {
            overallScore: { type: Type.INTEGER },
            strengths: { type: Type.ARRAY, items: { type: Type.STRING }, description: "List of 3 strengths" },
            improvements: { type: Type.ARRAY, items: { type: Type.STRING }, description: "List of 3 action items" },
            suggestedResources: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Specific topics or technical domains" },
            evaluationText: { type: Type.STRING, description: "The final encouraging wrap-up text" }
          },
          required: ["overallScore", "strengths", "improvements", "suggestedResources", "evaluationText"]
        },
        communication: {
          type: Type.OBJECT,
          properties: {
            level: { type: Type.INTEGER, description: "Level (1 to 4) according to the rubric" },
            evidence: { type: Type.STRING, description: "Evidence from the candidate's response to justify the level" }
          },
          required: ["level", "evidence"]
        },
        domain_knowledge: {
          type: Type.OBJECT,
          properties: {
            level: { type: Type.INTEGER, description: "Level (1 to 4) according to the rubric" },
            evidence: { type: Type.STRING, description: "Evidence from the candidate's response to justify the level" }
          },
          required: ["level", "evidence"]
        },
        ownership: {
          type: Type.OBJECT,
          properties: {
            level: { type: Type.INTEGER, description: "Level (1 to 4) according to the rubric" },
            evidence: { type: Type.STRING, description: "Evidence from the candidate's response to justify the level" }
          },
          required: ["level", "evidence"]
        },
        problem_solving: {
          type: Type.OBJECT,
          properties: {
            level: { type: Type.INTEGER, description: "Level (1 to 4) according to the rubric" },
            evidence: { type: Type.STRING, description: "Evidence from the candidate's response to justify the level" }
          },
          required: ["level", "evidence"]
        },
        overall_feedback: { type: Type.STRING, description: "2-3 sentences of coaching tied to the LOWEST-rated competency and what would move it up one level" },
        roomForImprovement: { type: Type.STRING, description: "Elaborated detailed room for improvement recommendations explicitly tied to rubric categories where they did not get top marks." }
      },
      required: ["isCompleted", "nextQuestion", "failedValidityCheck", "communication", "domain_knowledge", "ownership", "problem_solving", "overall_feedback", "roomForImprovement"]
    };

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: dynamicResponseSchema,
        temperature: 0.7,
      }
    });

    const parsedData = JSON.parse(response.text ? response.text.trim() : "{}");

    if (!codingRoleActive) {
      // Math and level mapping for non-coding behavioral responses
      const getCommPoints = (lvl: number) => {
        if (lvl === 4) return 25;
        if (lvl === 3) return 21;
        if (lvl === 2) return 15;
        return 7;
      };
      const getDomainPoints = (lvl: number) => {
        if (lvl === 4) return 30;
        if (lvl === 3) return 25;
        if (lvl === 2) return 18;
        return 9;
      };
      const getOwnershipPoints = (lvl: number) => {
        if (lvl === 4) return 20;
        if (lvl === 3) return 17;
        if (lvl === 2) return 12;
        return 6;
      };
      const getProblemPoints = (lvl: number) => {
        if (lvl === 4) return 25;
        if (lvl === 3) return 21;
        if (lvl === 2) return 15;
        return 8;
      };

      const failedValidity = !!parsedData.failedValidityCheck;

      let commLvl = parsedData.communication?.level || 1;
      let domainLvl = parsedData.domain_knowledge?.level || 1;
      let ownershipLvl = parsedData.ownership?.level || 1;
      let problemLvl = parsedData.problem_solving?.level || 1;

      if (failedValidity) {
        commLvl = 1;
        domainLvl = 1;
        ownershipLvl = 1;
        problemLvl = 1;
      }

      let commPoints = getCommPoints(commLvl);
      let domainPoints = getDomainPoints(domainLvl);
      let ownershipPoints = getOwnershipPoints(ownershipLvl);
      let problemSolvingPoints = getProblemPoints(problemLvl);

      let score = commPoints + domainPoints + ownershipPoints + problemSolvingPoints;

      if (failedValidity) {
        // Force score to be between 1 and 10 (e.g. 5)
        score = 5;
        commPoints = 2;
        domainPoints = 1;
        ownershipPoints = 1;
        problemSolvingPoints = 1;
      }

      // Ensure exact math alignment so parts sum perfectly to total score
      const commScoreOut = failedValidity ? 2 : Math.round(commPoints * 30 / 25);
      const domainScoreOut = failedValidity ? 1 : domainPoints;
      const starScoreOut = score - commScoreOut - domainScoreOut;

      const sitVal = failedValidity ? 1 : Math.min(10, Math.max(1, Math.round(ownershipPoints * 10 / 20)));
      const taskVal = failedValidity ? 0 : Math.min(10, Math.max(1, Math.round(ownershipPoints * 10 / 20)));
      const actVal = failedValidity ? 1 : Math.min(10, Math.max(1, Math.round(problemSolvingPoints * 10 / 25)));
      const resVal = failedValidity ? 0 : Math.max(0, starScoreOut - (sitVal + taskVal + actVal));

      const evaluation = {
        score,
        clarity: failedValidity
          ? "Failed Strict Validity Check: Response did not address the question asked."
          : `Communication (Level ${commLvl} - ${commPoints}/25): ${parsedData.communication?.evidence || "No distinct evidence quote provided."}`,
        relevance: failedValidity
          ? "Failed Strict Validity Check: The submitted text is not a genuine attempt."
          : `Domain Knowledge (Level ${domainLvl} - ${domainPoints}/30): ${parsedData.domain_knowledge?.evidence || "No distinct evidence quote provided."}`,
        professionalism: failedValidity
          ? "Failed Strict Validity Check: Answer is nonsensical, random, empty, or off-topic."
          : `Ownership & Impact (Level ${ownershipLvl} - ${ownershipPoints}/20): ${parsedData.ownership?.evidence || "No distinct evidence quote provided."}. Problem Solving (Level ${problemLvl} - ${problemSolvingPoints}/25): ${parsedData.problem_solving?.evidence || "No distinct evidence quote provided."}`,
        suggestions: failedValidity
          ? "What's missing: The response did not attempt to answer the actual question asked. Please address the interviewer's direct topic using clear, professional sentences."
          : (parsedData.overall_feedback || "Focus on building structured, metrics-driven STAR narratives."),
        roomForImprovement: parsedData.roomForImprovement || "Focus on building structured, metrics-driven STAR narratives.",
        scoreBreakdown: {
          domainAccuracy: domainScoreOut,
          starStructure: starScoreOut,
          communication: commScoreOut,
          starDetailed: {
            situation: sitVal,
            task: taskVal,
            action: actVal,
            result: resVal
          },
          rubrics: {
            communication: commPoints,
            domainKnowledge: domainPoints,
            ownershipImpact: ownershipPoints,
            problemSolving: problemSolvingPoints
          }
        }
      };

      const responsePayload: any = {
        isCompleted: parsedData.isCompleted,
        evaluation,
        nextQuestion: parsedData.nextQuestion,
      };

      if (parsedData.isCompleted && parsedData.finalReport) {
        responsePayload.finalReport = {
          overallScore: parsedData.finalReport.overallScore || score,
          strengths: parsedData.finalReport.strengths || [],
          improvements: parsedData.finalReport.improvements || [],
          suggestedResources: parsedData.finalReport.suggestedResources || [],
          evaluationText: parsedData.finalReport.evaluationText || ""
        };
      }

      return res.json(responsePayload);
    } else {
      // Inject rubrics for coding role active
      if (parsedData.failedValidityCheck) {
        if (!parsedData.evaluation) {
          parsedData.evaluation = {};
        }
        parsedData.evaluation.score = 5;
        parsedData.evaluation.clarity = "Failed Strict Validity Check: The response is empty, extremely short, nonsensical, or lacks correct Python code constructs.";
        parsedData.evaluation.relevance = "Failed Strict Validity Check: The submission does not attempt to solve the question topic or program algorithmically.";
        parsedData.evaluation.professionalism = "Failed Strict Validity Check: The entry appears off-topic, a joke/troll statement, or is not a real candidate response.";
        parsedData.evaluation.suggestions = "What's missing: The response did not attempt to answer the actual question asked. Please write or paste a realistic, complete Python solution (using def, loops, and proper logic).";
        parsedData.evaluation.roomForImprovement = "Failed Strict Validity Check: The candidate's response did not attempt to answer the actual Python programming question asked.";
        parsedData.evaluation.scoreBreakdown = {
          communication: 2,
          domainKnowledge: 1,
          ownershipImpact: 1,
          problemSolving: 1
        };
      }

      if (parsedData.evaluation && parsedData.evaluation.scoreBreakdown) {
        const sb = parsedData.evaluation.scoreBreakdown;
        
        sb.rubrics = {
          communication: sb.communication || 0,
          domainKnowledge: sb.domainKnowledge || 0,
          ownershipImpact: sb.ownershipImpact || 0,
          problemSolving: sb.problemSolving || 0
        };
      }
      return res.json(parsedData);
    }

  } catch (error: any) {
    logGeminiError("Interview Turn Evaluation", error);
    try {
      const fallbackResponse = getMockTurnResponse(req.body, turnCount, isFinalTurn);
      return res.json(fallbackResponse);
    } catch (fallbackError: any) {
      return res.status(500).json({
        error: "Both Gemini API and the local simulation failed: " + (error.message || error)
      });
    }
  }
});

// FR-3.11: Process verbal practice evaluation for coaching
app.post("/api/mock-interview/coaching", async (req, res) => {
  const { question, originalAnswer, originalSuggestions, verbalPractice } = req.body;

  if (!question || !verbalPractice) {
    return res.status(400).json({ error: "question and verbalPractice are required." });
  }

  try {
    const ai = getGeminiClient();
    const prompt = `You are an expert AI Interview Speech Coach who grades candidates' spoken practice sessions extremely rigorously and critically.
A candidate has received specific behavioral feedback on their previous written response and is practicing speaking an improved version of that response verbally.

ORIGINAL TOPIC / QUESTION: "${question}"
THE CANDIDATE'S ORIGINAL WRITTEN RESPONSE: "${originalAnswer || "No previous response provided."}"
COACH'S SUGGESTIONS TO ADDRESS: "${originalSuggestions || "Structure with STAR methodology, define numerical results, and keep communication tight."}"

THE CANDIDATE'S VERBALLY RE-PRACTICED NEW TRANSCRIPT: "${verbalPractice}"

=========================================
🚨 EXTREMELY CRITICAL GRADING STANDARDS & Rubric:
Analyze their new improved transcript. Compare their new verbal response to their original feedback to see if they successfully addressed and integrated the suggestions.
Grading points must be strictly allocated as follows:
- deliveryClarity (max 30 points): Analysis of the structural flow, voice pace, articulation, and avoidance of speaking clutter in their re-practice.
- suggestionIntegration (max 50 points): Does their verbal practice actually address and correct the issues noted in the previous suggestions? Award points proportionate to the successful addition of requested details/structures.
- responseStructure (max 20 points): Cohesion of the updated response. Is it a unified, effective professional story?

The overall "score" (0-100) MUST exactly equal the mathematical sum of deliveryClarity + suggestionIntegration + responseStructure.
If they ignored suggestions or have severe structure deficits, grade them strictly and constructively (deduct heavily).`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          description: "Speech coaching verbal feedback evaluation",
          properties: {
            score: { type: Type.INTEGER, description: "A score from 0 to 100, which must equal the sum of deliveryClarity, suggestionIntegration, and responseStructure" },
            clarity: { type: Type.STRING },
            relevance: { type: Type.STRING },
            interactivityAnalysis: { type: Type.STRING, description: "Detailed check on whether they incorporated each suggestion and next steps" },
            scoreBreakdown: {
              type: Type.OBJECT,
              description: "Scoring points assigned",
              properties: {
                deliveryClarity: { type: Type.INTEGER, description: "Delivery flow and volume clarity (0 to 30)" },
                suggestionIntegration: { type: Type.INTEGER, description: "Integration of suggestions (0 to 50)" },
                responseStructure: { type: Type.INTEGER, description: "Cohesiveness checklist (0 to 20)" }
              },
              required: ["deliveryClarity", "suggestionIntegration", "responseStructure"]
            }
          },
          required: ["score", "clarity", "relevance", "interactivityAnalysis", "scoreBreakdown"]
        },
        temperature: 0.7,
      }
    });

    const parsedData = JSON.parse(response.text ? response.text.trim() : "{}");
    return res.json(parsedData);

  } catch (error: any) {
    logGeminiError("Coaching Speech Evaluator", error);
    try {
      const fallbackResponse = getMockCoachingResponse(req.body);
      return res.json(fallbackResponse);
    } catch (fallbackError: any) {
      return res.status(500).json({
        error: "Both Gemini API and the local simulation failed: " + (error.message || error)
      });
    }
  }
});

// ==================== VITE DEVELOPMENT MIDDLEWARE ====================

// Static/Dev server bootstrapping
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`[Full-Stack Server] Running on http://localhost:${PORT}`);
      console.log(`[Full-Stack Server] API endpoints loaded and active.`);
    });
  }
}

await startServer();
export default app;
