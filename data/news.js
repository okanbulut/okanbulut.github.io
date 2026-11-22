/* ============================================================
   NEWS DATA — edit this file to update the News section on the
   home page.
   ------------------------------------------------------------
   HOW TO ADD A NEWS ITEM:
   Copy one of the blocks below and paste it at the TOP of the
   list (newest first). Each item has:
     date: a short label shown in the badge (e.g., "June 2026")
     html: the news text. You can use simple HTML tags such as
           <strong>...</strong>, <em>...</em>, and
           <a href="...">links</a>.
     lab:  optional. Add  lab: true,  to also show the item in
           the Lab news section of the My Lab page.
   Keep the trailing comma after each closing brace.

   HOME VS. ARCHIVE:
   The home page shows items dated NEWS_HOME_FROM_YEAR or later.
   Older items appear on the News archive page (news/). Change
   the year below when you want to move a year to the archive.
   ============================================================ */

const NEWS_HOME_FROM_YEAR = 2026;

const NEWS = [
  {
  date: "November 2026",
  html: "I'll be a panelist at <strong>Learning and Teaching with AI: EQUAL-AI K–12 Education Forum</strong>, hosted at OISE, University of Toronto, on Tuesday, November 24 (10:00 a.m. to 12:00 p.m. ET), at the Dr. Eric Jackman Institute of Child Study. The forum brings together educators and researchers from across Canada to explore how AI is reshaping children's learning, teaching, and assessment. Attendance is in person or by livestream (<a href='https://oise.jotform.com/263014444504852'>register here</a>).",
  },
  {
  date: "November 2026",
  lab: true,
  html: "Seven of our papers were accepted for the <strong>NCME 2027 Annual Meeting</strong> in Toronto in April 2027:<ul><li><em>Comparing slow and non-slow responses in computerized assessments with transition network analysis</em> (Daniel Jerez)</li><li><em>From learn to apply: Profiling behavioral engagement in digital assessment with process data</em> (Joyce Liu)</li><li><em>Predicting item nonresponse from item features using explainable machine learning</em> (Mehrdad Yousefpoori-Naeim, Bin Tan)</li><li><em>When order matters: Positional bias in open-weight LLMs on multiple choice items</em> (Joyce Liu, Eunji Kim)</li><li><em>Structural validation with hierarchical network psychometrics: Social-emotional skills across cultural contexts</em> (Kevin Vo)</li><li><em>Do item positions impact response processes? Evidence from TIMSS 2023 interactive items</em> (Doris Abroampah, Joyce Liu)</li><li><em>Understanding early test termination through first-task time-use patterns</em> (Eunji Kim)</li></ul>",
  },
  {
  date: "November 2026",
  lab: true,
  html: "Bin Tan and I received a <strong>TLEF Innovation Grant</strong> from the University of Alberta for our one-year project, <em>Toward AI-Resilient Multiple-Choice Assessment: Using Conversation to Diagnose Misconceptions and Support Formative Learning</em>.",
  },
  {
  date: "November 2026",
  html: "I released <a href='https://www.okanbulut.com/mirtverse/'>mirtverse</a> as a friendly workflow and reporting layer for the mirt package in R. Along with the package, I posted interactive labs for students, several materials for instructors who may use mirtverse to teach item response theory, and an online book, titled <a href='https://www.okanbulut.com/mirtverse/book/index.html'>Item Response Theory with mirt and mirtverse</a>.",
  },
  {
  date: "October 2026",
  html: "I attended <a href='https://ncme.org/events/aime-conference/'>AIME-Con 2026</a> in Pittsburgh, PA during the first week of October. The conference was full of inspiring presentations and discussions. The conference proceedings, also including our study titled 'The Scoring Paradox: Multi-Agent Architectures for Unbiased Feedback Optimization', are available at <a href='https://aclanthology.org/volumes/2026.aimecon-sessions/'>the ACL website</a>.",
  },
  {
  date: "September 2026",
  html: "I was on <a href='https://www.ctvnews.ca/edmonton/video/2026/09/01/why-ai-is-both-a-tool-and-a-threat-to-education/'>CTV Your Morning</a> to talk about <strong>how AI is impacting education</strong>. We talked about the benefits of AI (e.g., efficiency) and potential drawbacks (e.g., cognitive offloading).",
  },
  {
    date: "June 2026",
    html: "Our team presented four papers at the <strong>International Conference on Artificial Intelligence in Education (AIED 2026)</strong> in Seoul, South Korea, including new work on automated quality assurance for LLM-generated feedback.",
  },
  {
    date: "April 2026",
    html: "Busy conference season! Our lab presented nine papers at the <strong>NCME Annual Meeting</strong> in Los Angeles and four papers at <strong>LAK26</strong> in Bergen, Norway.",
  },
  {
    date: "February 2026",
    html: "New paper published in <em>Behavior Research Methods</em>: <strong>Scale abbreviation with supervised machine learning</strong> — a comparison of feature selection techniques.",
  },
  {
    date: "December 2025",
    html: "Gave an invited talk on the promise and practice of AI chatbots in teacher professional development at the <strong>Polish Academy of Sciences</strong> PAN-Metrics seminar.",
  },
  {
    date: "July 2025",
    html: "Presented our work on deep reinforcement learning for engagement-aware adaptive assessment at <strong>AIED 2025</strong> in Palermo, Italy.",
  },
];

