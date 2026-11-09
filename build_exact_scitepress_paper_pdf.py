import os
import sys
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY, TA_LEFT, TA_RIGHT
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import (
    BaseDocTemplate,
    PageTemplate,
    Frame,
    Paragraph,
    Spacer,
    FrameBreak,
    NextPageTemplate,
    Table,
    TableStyle,
    Image,
)
from reportlab.pdfgen import canvas

class ScitepressNumberedCanvas(canvas.Canvas):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        for state in self._saved_page_states:
            self.__dict__.update(state)
            super().showPage()
        super().save()

def generate_exact_scitepress_pdf(filename="AI_API_Reverse_Engineering_Platform_Research_Paper.pdf"):
    PAGE_W, PAGE_H = A4
    LEFT_M = 73.70
    RIGHT_M = 73.70
    TOP_M = 93.54
    BOT_M = 119.05
    PRINT_W = PAGE_W - LEFT_M - RIGHT_M  # 447.88
    PRINT_H = PAGE_H - TOP_M - BOT_M    # 629.30
    COL_W = 212.60
    COL_GUTTER = 22.68
    COL2_X = LEFT_M + COL_W + COL_GUTTER # 308.98

    HEADER_H = 320
    P1_COL_H = PRINT_H - HEADER_H - 12
    HEADER_Y = BOT_M + P1_COL_H + 12

    frame_p1_header = Frame(
        LEFT_M, HEADER_Y, PRINT_W, HEADER_H,
        id='p1_header', leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0
    )
    frame_p1_c1 = Frame(
        LEFT_M, BOT_M, COL_W, P1_COL_H,
        id='p1_c1', leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0
    )
    frame_p1_c2 = Frame(
        COL2_X, BOT_M, COL_W, P1_COL_H,
        id='p1_c2', leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0
    )

    template_p1 = PageTemplate(
        id='FirstPage',
        frames=[frame_p1_header, frame_p1_c1, frame_p1_c2]
    )

    frame_later_c1 = Frame(
        LEFT_M, BOT_M, COL_W, PRINT_H,
        id='later_c1', leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0
    )
    frame_later_c2 = Frame(
        COL2_X, BOT_M, COL_W, PRINT_H,
        id='later_c2', leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0
    )

    template_later = PageTemplate(
        id='LaterPages',
        frames=[frame_later_c1, frame_later_c2]
    )

    doc = BaseDocTemplate(
        filename,
        pagesize=A4,
        leftMargin=LEFT_M,
        rightMargin=RIGHT_M,
        topMargin=TOP_M,
        bottomMargin=BOT_M
    )
    doc.addPageTemplates([template_p1, template_later])

    title_style = ParagraphStyle(
        'PaperTitle',
        fontName='Times-Bold',
        fontSize=15,
        leading=17,
        alignment=TA_CENTER,
        spaceAfter=12
    )

    author_style = ParagraphStyle(
        'PaperAuthors',
        fontName='Times-Roman',
        fontSize=11,
        leading=13,
        alignment=TA_CENTER,
        spaceBefore=14,
        spaceAfter=4
    )

    affil_style = ParagraphStyle(
        'PaperAffiliations',
        fontName='Times-Italic',
        fontSize=9,
        leading=11,
        alignment=TA_CENTER,
        spaceAfter=2
    )

    email_style = ParagraphStyle(
        'PaperEmails',
        fontName='Times-Roman',
        fontSize=9,
        leading=11,
        alignment=TA_CENTER,
        spaceAfter=16
    )

    keywords_style = ParagraphStyle(
        'PaperKeywords',
        fontName='Times-Roman',
        fontSize=9,
        leading=11,
        alignment=TA_JUSTIFY,
        leftIndent=48,
        firstLineIndent=-48,
        spaceBefore=8,
        spaceAfter=6
    )

    abstract_style = ParagraphStyle(
        'PaperAbstract',
        fontName='Times-Roman',
        fontSize=9,
        leading=11,
        alignment=TA_JUSTIFY,
        leftIndent=48,
        firstLineIndent=-48,
        spaceBefore=6,
        spaceAfter=10
    )

    h1_style = ParagraphStyle(
        'SectionH1',
        fontName='Times-Bold',
        fontSize=13,
        leading=15,
        alignment=TA_LEFT,
        leftIndent=18,
        firstLineIndent=-18,
        spaceBefore=14,
        spaceAfter=8,
        keepWithNext=True
    )

    h1_first_style = ParagraphStyle(
        'SectionH1First',
        parent=h1_style,
        spaceBefore=0,
        spaceAfter=8
    )

    h2_style = ParagraphStyle(
        'SectionH2',
        fontName='Times-Bold',
        fontSize=12,
        leading=13,
        alignment=TA_LEFT,
        leftIndent=24,
        firstLineIndent=-24,
        spaceBefore=10,
        spaceAfter=6,
        keepWithNext=True
    )

    h3_style = ParagraphStyle(
        'SectionH3',
        fontName='Times-Bold',
        fontSize=11,
        leading=12,
        alignment=TA_LEFT,
        leftIndent=24,
        firstLineIndent=-24,
        spaceBefore=8,
        spaceAfter=5,
        keepWithNext=True
    )

    body_first_style = ParagraphStyle(
        'BodyFirst',
        fontName='Times-Roman',
        fontSize=10,
        leading=12,
        alignment=TA_JUSTIFY,
        firstLineIndent=0,
        spaceAfter=4
    )

    body_style = ParagraphStyle(
        'BodyPara',
        fontName='Times-Roman',
        fontSize=10,
        leading=12,
        alignment=TA_JUSTIFY,
        firstLineIndent=14.17,
        spaceAfter=4
    )

    table_caption_style = ParagraphStyle(
        'TableCaptionStyle',
        fontName='Times-Roman',
        fontSize=9,
        leading=11,
        alignment=TA_JUSTIFY,
        spaceBefore=8,
        spaceAfter=4
    )

    caption_style = ParagraphStyle(
        'CaptionStyle',
        fontName='Times-Roman',
        fontSize=9,
        leading=11,
        alignment=TA_JUSTIFY,
        spaceBefore=6,
        spaceAfter=6
    )

    code_style = ParagraphStyle(
        'ProgramCode',
        fontName='Courier',
        fontSize=7.2,
        leading=9.0,
        alignment=TA_LEFT,
        leftIndent=4,
        spaceBefore=2,
        spaceAfter=2
    )

    ref_style = ParagraphStyle(
        'ReferenceEntry',
        fontName='Times-Roman',
        fontSize=9,
        leading=11,
        alignment=TA_JUSTIFY,
        leftIndent=14.17,
        firstLineIndent=-14.17,
        spaceAfter=4
    )

    th_style = ParagraphStyle(
        'TableHeader',
        fontName='Times-Bold',
        fontSize=7.5,
        leading=9.5,
        alignment=TA_LEFT
    )
    td_style = ParagraphStyle(
        'TableCell',
        fontName='Times-Roman',
        fontSize=7.2,
        leading=9.0,
        alignment=TA_LEFT
    )

    story = []

    # Title & Front matter
    story.append(Paragraph(
        "AI API Reverse-Engineering Platform: Zero-Execution AST Analysis with Grounded LLM Reasoning for Automated API Documentation",
        title_style
    ))
    story.append(Paragraph("Nagesh Pawar <sup>1 a</sup>, Guide Name <sup>2 b</sup>", author_style))
    story.append(Paragraph("<sup>1</sup> Department of Computer Science and Engineering, Your Institution Name, City, Country", affil_style))
    story.append(Paragraph("<sup>2</sup> Department of Computer Science and Engineering, Your Institution Name, City, Country", affil_style))
    story.append(Paragraph("your_email@institution.edu, guide_email@institution.edu", email_style))

    story.append(Paragraph(
        "<b>Keywords:</b> API Reverse Engineering, Static Analysis, Abstract Syntax Tree, OpenAPI, Large Language Models, Design Science, DevSecOps.",
        keywords_style
    ))
    story.append(Paragraph(
        "<b>Abstract:</b> Backend repositories are often inherited with little or no API documentation, and recovering the contract of an API by hand is slow and error-prone. "
        "This paper follows a design science approach to build and evaluate the AI API Reverse-Engineering Platform, which ingests a ZIP archive or a public GitHub repository "
        "and recovers the API surface without executing the untrusted code. A deterministic abstract syntax tree (AST) engine resolves routes, mount prefixes, middleware, "
        "parameters, status codes and ORM schemas, and a grounded reasoning layer based on large language models adds business intent while labelling each statement as detected "
        "or inferred with a file and line citation. A single normalised model drives OpenAPI 3.0 specifications, Postman collections, CI/CD pipeline flows, ER diagrams, security audits, "
        "Jest and Supertest suites and an SSRF-protected playground. Evaluated through three research questions on an e-commerce and authentication demonstration backend, "
        "the engine discovered all routes (RC = 100%), executed no repository code and produced all seven artifact types in one run. The study is limited to one backend and one framework; broader benchmarks and a user study are planned.",
        abstract_style
    ))

    story.append(FrameBreak())
    story.append(NextPageTemplate('LaterPages'))

    # Section 1
    story.append(Paragraph("1 INTRODUCTION", h1_first_style))
    story.append(Paragraph("1.1 Background and Motivation", h2_style))
    story.append(Paragraph(
        "Web APIs are the integration layer of modern software, and REST [1] remains the dominant style for exposing them [2]. "
        "In microservice-oriented systems [3]–[5] the number of endpoints grows quickly and routes are added, renamed and re-mounted continuously, "
        "while the documents that should describe them are updated late or never. Empirical studies of API documentation report incomplete, ambiguous "
        "and outdated content as recurrent problems [6], [7], practitioner surveys find that documentation is valued yet frequently out of date [8], "
        "and the cost and benefit of documentation have been studied systematically [9]. Poor documentation is also among the barriers reported for newcomers to open-source projects [10].",
        body_first_style
    ))
    story.append(Paragraph(
        "For a developer who inherits an undocumented backend, the source code is the only authoritative statement of the API contract, yet recovering it means "
        "reading nested router definitions, middleware chains and controllers spread over many files. The consequences are felt downstream: front-end teams guess "
        "request and response shapes, testers write collections by hand, and automated REST test generators, which typically consume an OpenAPI description [11]–[14], "
        "cannot start without an accurate one.",
        body_style
    ))
    story.append(Paragraph(
        "Existing automation covers only part of the problem. Annotation-based generators need framework-specific metadata that developers must add beforehand [15], "
        "and dynamic approaches need a running system and representative inputs [16]. Large language models (LLMs) summarise code fluently [17], [18] but hallucinate "
        "when they are not anchored to verifiable evidence [19], [20]. The safety of the analysis host is a further concern: a repository is untrusted input, "
        "and tools that install dependencies or start the application in order to inspect it execute arbitrary code taken from that repository.",
        body_style
    ))

    story.append(Paragraph("1.2 Research Questions and Contributions", h2_style))
    story.append(Paragraph(
        "This paper treats the problem as a design science task [21], [22]: an artifact, the AI API Reverse-Engineering Platform, is built and then evaluated against explicit research questions (RQs): "
        "• <b>RQ1 (completeness):</b> how completely does a zero-execution AST engine recover the route surface of an Express backend? "
        "• <b>RQ2 (safety):</b> can an untrusted repository be analysed without executing its code on the analysis host? "
        "• <b>RQ3 (artifact coverage):</b> can the documentation, specification, graph, security and test artifacts be generated from a single knowledge model in one run? "
        "A fourth question, on the effect of the platform on developer onboarding time, requires a user study and is deferred to Section 8.",
        body_first_style
    ))
    story.append(Paragraph(
        "The contributions of the paper are: "
        "(1) a zero-execution ingestion and AST pipeline that recovers routes, mount prefixes, middleware chains, parameters, status codes and ORM schemas from Node.js and Express projects written in JavaScript or TypeScript; "
        "(2) a grounding discipline in which compiler facts are labelled DETECTED and language-model statements are labelled INFERRED with file and line citations, which limits the effect of hallucination; "
        "(3) a canonical knowledge model from which OpenAPI, Postman, CI/CD pipeline flows, ER diagrams, security findings, test suites, an SSRF-protected playground and a citation-backed chat are generated in one dashboard; and "
        "(4) a structured evaluation of completeness, safety and artifact coverage on a demonstration backend.",
        body_style
    ))
    story.append(Paragraph(
        "The paper is organised as follows. Section 2 reviews related work, Section 3 describes the research methodology, Section 4 presents the system design, "
        "Section 5 the implementation, Section 6 the evaluation, Section 7 the threats to validity and Section 8 concludes.",
        body_style
    ))

    # Section 2
    story.append(Paragraph("2 RELATED WORK", h1_style))
    story.append(Paragraph("2.1 API Documentation and Specification Recovery", h2_style))
    story.append(Paragraph(
        "Inferring API properties from code is an established topic. Robillard et al. [16] survey static and dynamic techniques that infer properties such as the call ordering of library APIs and show that program analysis can recover constraints without developer annotations. Their focus is in-process libraries, not network-facing endpoints, whose contract is formed by verbs, path templates assembled across files, middleware and payload shapes. Wittern et al. [23] analyse JavaScript clients statically to check web API requests against specifications; the work shows the value of static reasoning for web APIs but operates on the consumer side and presupposes an existing specification. On the server side, Lercher et al. [15] generate OpenAPI descriptions from Java source code and compare their accuracy with annotation-driven tools such as springdoc-openapi. This supports the premise that specifications can be derived from code, but the approach is specific to the Java ecosystem. The need for accurate specifications is reinforced by REST testing research. RESTler [11], EvoMaster [12] and the tools compared by Kim et al. [13] work from API descriptions, a recent survey [14] organises the field around them, and KAT [24] adds LLM-based test generation that exploits dependencies between operations. Maalej and Robillard [7] provide a taxonomy of knowledge types in API reference documentation against which generated documentation can be assessed.",
        body_first_style
    ))

    story.append(Paragraph("2.2 Static Analysis of JavaScript", h2_style))
    story.append(Paragraph(
        "Static analysis of JavaScript is difficult because of the dynamic features of the language. Type analysis for JavaScript was an early response [25], later work shows that frameworks and libraries complicate analysis further [26], and a survey of dynamic analysis and test generation for JavaScript [27] documents the trade-offs between the two families of techniques. The engine presented here therefore does not aim at whole-program soundness. It exploits the fact that Express route registration follows a small set of syntactic idioms, so that a syntax-directed traversal of the abstract syntax tree [28], [29] suffices for the common cases, and it marks what it cannot resolve statically. The theory of such analyses is covered by Nielson et al. [30]. Practical experience also matters. Johnson et al. [31] found that developers avoid static analysis tools when warnings are false or hard to act upon, and Sadowski et al. [32] report that analysis at scale succeeded at Google because findings were actionable and integrated into developer workflows. This motivates the DETECTED and INFERRED labels of the platform, which tell the reader how much each statement can be trusted.",
        body_first_style
    ))

    story.append(Paragraph("2.3 Static and Dynamic Analysis in Security-Oriented Reverse Engineering", h2_style))
    story.append(Paragraph(
        "Reverse engineering is widely practised in security, where the choice between static and dynamic analysis is a recurring theme. Javed et al. [33] review 236 papers on binary code analysis and devote one of their six areas to evasion and anti-analysis strategies and their countermeasures. Evasion is common: in 117,270 Android apps, Suo et al. [34] found that almost all benign (99.6%) and malicious (97.0%) apps implement at least one category of anti-runtime-analysis technique, which can lead to inaccurate analysis results. Norby et al. [35] measure the performance overhead of six categories of anti-debugging techniques on Windows and Linux, and Padhy et al. [36] show how binding execution to a machine through DRM fingerprinting and thread-local-storage callbacks thwarts sandbox, virtual-machine and debugger-based analysis. Static approaches remain effective in this setting. Kurniawan et al. [37] reach 97% accuracy in detecting Android malware from statically extracted features, and Bartłomiejczyk et al. [38] report that permission-based static analysis still detects SMS-stealing malware under several obfuscation strategies, with a detection rate of almost 70%. Morić et al. [39] conclude that hybrid analysis that integrates static, dynamic and simulated testing improves detection reliability, but they carry out the dynamic work in controlled environments, which illustrates the cost of executing untrusted code safely. These studies concern binaries and malware rather than API source code. We use them only as evidence for a design principle, namely that the analysis of untrusted artifacts should not depend on running them, and apply that principle to source-level API recovery.",
        body_first_style
    ))

    story.append(Paragraph("2.4 LLMs for Software Engineering and Documentation", h2_style))
    story.append(Paragraph(
        "Transformer-based language models [40] pre-trained on text and code [17], [41], [42] are now applied across the software engineering lifecycle [18], [43]. For documentation, RepoAgent [44] generates repository-level documentation with an LLM. For reverse engineering, Hu et al. [45] systematise LLM-based work and report that retrieval and grounding improve factual accuracy while hallucination and weak reproducibility remain open issues, and Siala and Lano [46] and Boronat and Mustafa [47] explore LLMs in model-driven reverse engineering. Hallucination is documented extensively [19], [20], retrieval-augmented generation [48], [49] is the main mitigation, LLM-written code has been shown to contain security weaknesses [50], and repository-level benchmarks such as SWE-bench [51] show that tasks requiring an understanding of whole repositories remain hard for language models.",
        body_first_style
    ))

    story.append(Paragraph("2.5 Summary and Research Gap", h2_style))
    story.append(Paragraph(
        "Table 1 positions the platform against representative work. Three observations motivate the design. First, each contribution solves one sub-problem, such as specification generation, documentation or testing, whereas developers need the whole set of artifacts in one place. Second, specification generators are tied to one technology stack and, when LLMs are used, the output is rarely separated into verified facts and model conjecture. Third, the safety of the analysis host is seldom treated as a design requirement, although repository analysis necessarily handles untrusted code.",
        body_first_style
    ))

    # Table 1
    story.append(Paragraph("Table 1: Positioning of this work against related approaches.", table_caption_style))
    t1_data = [
        [Paragraph("<b>Work</b>", th_style), Paragraph("<b>Analysis</b>", th_style), Paragraph("<b>Runs code?</b>", th_style), Paragraph("<b>Main output</b>", th_style)],
        [Paragraph("Robillard et al. [16]", td_style), Paragraph("Survey: static/dynamic", td_style), Paragraph("Partly", td_style), Paragraph("Library API properties", td_style)],
        [Paragraph("Wittern et al. [23]", td_style), Paragraph("Static, JS clients", td_style), Paragraph("No", td_style), Paragraph("Request checks", td_style)],
        [Paragraph("Lercher et al. [15]", td_style), Paragraph("Static, Java source", td_style), Paragraph("No", td_style), Paragraph("OpenAPI description", td_style)],
        [Paragraph("Luo et al. [44]", td_style), Paragraph("LLM, repository level", td_style), Paragraph("No", td_style), Paragraph("Code docs", td_style)],
        [Paragraph("Le et al. [24]", td_style), Paragraph("LLM, spec driven", td_style), Paragraph("Yes (live API)", td_style), Paragraph("API test cases", td_style)],
        [Paragraph("This work", td_style), Paragraph("AST + grounded LLM", td_style), Paragraph("No", td_style), Paragraph("Specs, graphs, tests, audits", td_style)],
    ]
    tab1 = Table(t1_data, colWidths=[55, 52, 45, 60])
    tab1.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#e2e8f0')),
        ('BOX', (0,0), (-1,-1), 0.5, colors.HexColor('#64748b')),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor('#cbd5e1')),
        ('PADDING', (0,0), (-1,-1), 2),
    ]))
    story.append(tab1)

    # Section 3
    story.append(Paragraph("3 RESEARCH METHODOLOGY", h1_style))
    story.append(Paragraph("3.1 Research Design", h2_style))
    story.append(Paragraph(
        "The work follows the design science paradigm [21], in which knowledge is gained by building and evaluating an artifact that addresses a relevant problem. The process is structured according to the six activities of the design science research methodology of Peffers et al. [22]; Table 2 maps each activity to the part of this paper in which it is reported. The evaluation follows the case-study guidelines of Runeson and Höst [52], with the platform applied to a demonstration backend as the unit of analysis, and the research questions are refined with the Goal–Question–Metric approach [53].",
        body_first_style
    ))

    # Table 2
    story.append(Paragraph("Table 2: Design science activities and where they are reported.", table_caption_style))
    t2_data = [
        [Paragraph("<b>Activity</b>", th_style), Paragraph("<b>Application in this work</b>", th_style), Paragraph("<b>Section</b>", th_style)],
        [Paragraph("1. Problem", td_style), Paragraph("Undocumented backends, unsafe analysis, LLM hallucination", td_style), Paragraph("1, 3.2", td_style)],
        [Paragraph("2. Objectives", td_style), Paragraph("Five objectives O1 to O5", td_style), Paragraph("3.2", td_style)],
        [Paragraph("3. Design", td_style), Paragraph("Four-stage pipeline, AST engine, grounding", td_style), Paragraph("4, 5", td_style)],
        [Paragraph("4. Demonstration", td_style), Paragraph("Analysis of an e-commerce and authentication API", td_style), Paragraph("6.1", td_style)],
        [Paragraph("5. Evaluation", td_style), Paragraph("RQ1 to RQ3 with defined metrics", td_style), Paragraph("6.2", td_style)],
        [Paragraph("6. Communication", td_style), Paragraph("This paper", td_style), Paragraph("all", td_style)],
    ]
    tab2 = Table(t2_data, colWidths=[65, 107, 40])
    tab2.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#e2e8f0')),
        ('BOX', (0,0), (-1,-1), 0.5, colors.HexColor('#64748b')),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor('#cbd5e1')),
        ('PADDING', (0,0), (-1,-1), 2),
    ]))
    story.append(tab2)

    story.append(Paragraph("3.2 Problem Statement and Objectives", h2_style))
    story.append(Paragraph(
        "Four recurring challenges motivate the work. (i) Knowledge loss and onboarding friction: when authors leave, undocumented routing logic becomes tribal knowledge and newcomers must trace nested router.use() calls, middleware gates and controllers manually. (ii) Contract mismatch and QA overhead: front-end and mobile teams guess request and response shapes, and testers write Postman collections and curl commands by hand. (iii) Hidden architectural dependencies: nothing shows which route reaches which controller, service or database model. (iv) Security exposure: state-changing endpoints (POST, PUT, DELETE) frequently lack authentication middleware [54], and dynamic analysis tools run the untrusted application, for example with npm start, which exposes the analysis host.",
        body_first_style
    ))
    story.append(Paragraph(
        "The objectives of the platform are therefore to: "
        "• <b>(O1)</b> build an extensible static AST parser for Node.js and Express that extracts routes, handlers and parameter schemas; "
        "• <b>(O2)</b> construct an ORM analyzer that extracts database models, fields, keys and relations; "
        "• <b>(O3)</b> synthesise standards-compliant OpenAPI 3.0 specifications and Postman collections; "
        "• <b>(O4)</b> develop a static security scanner that flags broken authentication, missing input validation and injection-prone patterns; "
        "• <b>(O5)</b> deploy a conversational assistant that answers codebase questions with exact file and line citations.",
        body_style
    ))
    story.append(Paragraph(
        "The current version covers Node.js and Express REST architectures in JavaScript and TypeScript, Prisma, Mongoose and Sequelize models, safe ZIP upload and public GitHub cloning, an interactive React Flow graph with a Mermaid ER diagram, Jest and Supertest synthesis and a guarded API playground. Analyzers for Fastify, NestJS, Django, FastAPI, Spring Boot and Laravel, and real-time Git webhook synchronisation, are outside the scope of this version.",
        body_style
    ))

    story.append(Paragraph("3.3 Goal, Questions and Metrics", h2_style))
    story.append(Paragraph(
        "Following the Goal–Question–Metric approach [53], the goal is to analyse the platform for the purpose of evaluation with respect to completeness, safety and artifact coverage, from the viewpoint of a developer who inherits an undocumented Express backend. Table 3 lists the research questions with their metrics and the evidence collected.",
        body_first_style
    ))

    # Table 3
    story.append(Paragraph("Table 3: Research questions, metrics and evidence.", table_caption_style))
    t3_data = [
        [Paragraph("<b>RQ</b>", th_style), Paragraph("<b>Metric</b>", th_style), Paragraph("<b>Evidence collected</b>", th_style)],
        [Paragraph("RQ1", td_style), Paragraph("Route coverage RC (Eq. 2)", td_style), Paragraph("Engine output vs. manual route set", td_style)],
        [Paragraph("RQ2", td_style), Paragraph("Host executions HE", td_style), Paragraph("Inspection of pipeline and run observation", td_style)],
        [Paragraph("RQ3", td_style), Paragraph("Artifact types (out of 7)", td_style), Paragraph("One analysis run; dashboard outputs checked", td_style)],
        [Paragraph("RQ4", td_style), Paragraph("Onboarding time, INFERRED accuracy", td_style), Paragraph("Planned user study (future work)", td_style)],
    ]
    tab3 = Table(t3_data, colWidths=[32, 85, 95])
    tab3.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#e2e8f0')),
        ('BOX', (0,0), (-1,-1), 0.5, colors.HexColor('#64748b')),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor('#cbd5e1')),
        ('PADDING', (0,0), (-1,-1), 2),
    ]))
    story.append(tab3)

    # Section 4
    story.append(Paragraph("4 SYSTEM DESIGN", h1_style))
    story.append(Paragraph("4.1 Architecture Overview", h2_style))
    story.append(Paragraph(
        "Figure 1 shows the four-stage pipeline. Stage 1 ingests and sanitises the repository, Stage 2 extracts deterministic facts with an AST engine, Stage 3 enriches them with a grounded reasoning layer, and Stage 4 renders all artifacts from the resulting normalised model. The ordering is deliberate: the language model never sees unverified input as truth and never writes into the set of detected facts.",
        body_first_style
    ))

    if os.path.exists("fig1_four_stage_architecture.png"):
        story.append(Image("fig1_four_stage_architecture.png", width=COL_W, height=COL_W * 7.5 / 5.5))
        story.append(Paragraph("Figure 1: Four-stage architecture of the platform.", caption_style))

    story.append(Paragraph("4.2 Safe Ingestion", h2_style))
    story.append(Paragraph(
        "The platform accepts a ZIP archive or the URL of a public GitHub repository. Archives are extracted with explicit path sanitisation: the resolved path of every entry must remain inside the workspace directory, which blocks Zip Slip attacks in which entries such as ../../x escape the extraction directory [55]. Public repositories are cloned into the workspace and treated exactly like an extracted archive. No step invokes a package manager, a build tool or a shell on repository content; files are only read as text and parsed. Consequently, install scripts, post-install hooks and start-up code of the uploaded project cannot run on the analysis host.",
        body_first_style
    ))

    story.append(Paragraph("4.3 Static AST Engine", h2_style))
    story.append(Paragraph(
        "The engine parses every JavaScript and TypeScript file with the Babel parser [29] and traverses the trees with the Babel traversal library. Four analyses run over the resulting syntax trees.",
        body_first_style
    ))

    story.append(Paragraph("4.3.1 Framework Detection", h3_style))
    story.append(Paragraph(
        "A detector inspects the package.json dependencies and file-level heuristics, for example imports of express [56] and calls to Router(), to select an analyzer. At present Express is supported; the analyzer interface is designed so that Fastify, NestJS or non-JavaScript frameworks can be added as plugins.",
        body_first_style
    ))

    story.append(Paragraph("4.3.2 Route and Mount Resolution", h3_style))
    story.append(Paragraph(
        "Express applications assemble URLs across files: a router declares relative paths and a parent mounts it under a prefix with app.use. The full path of a route r is therefore the normalised concatenation of all mount prefixes on the way from the application entry module to r, followed by the path of the route itself (Equation (1)).",
        body_first_style
    ))

    eq1_data = [[
        Paragraph("<i>P</i>(<i>r</i>) = norm(<i>m</i><sub>1</sub> · <i>m</i><sub>2</sub> · … · <i>m</i><sub><i>k</i></sub> · <i>p</i><sub><i>r</i></sub>)", ParagraphStyle('Eq1', fontName='Times-Italic', fontSize=10, leading=12, alignment=TA_CENTER)),
        Paragraph("(1)", ParagraphStyle('EqN1', fontName='Times-Roman', fontSize=10, leading=12, alignment=TA_RIGHT))
    ]]
    t_eq1 = Table(eq1_data, colWidths=[175, 37])
    t_eq1.setStyle(TableStyle([('VALIGN', (0,0), (-1,-1), 'MIDDLE'), ('PADDING', (0,0), (-1,-1), 0), ('TOPPADDING', (0,0), (-1,-1), 4), ('BOTTOMPADDING', (0,0), (-1,-1), 4)]))
    story.append(t_eq1)

    story.append(Paragraph(
        "Here mi are the mount prefixes, pr is the route path declared in the router, · denotes string concatenation and norm collapses duplicate and trailing slashes. Algorithm 1 performs this resolution recursively. Starting at the entry module with an empty prefix, it records every verb call (get, post, put, patch, delete) together with its middleware list and handler reference and, for every mount call, resolves the imported child router through the import graph and recurses with the extended prefix. A visited set keyed by module and prefix prevents infinite recursion on cyclic imports.",
        body_first_style
    ))

    # Algorithm 1
    algo1_code = (
        "<b>Data:</b> module M, prefix π (initially empty), visited set V<br/>"
        "<b>Result:</b> route records R<br/>"
        "<b>if</b> (M, π) ∈ V <b>then return</b> ∅;<br/>"
        "add (M, π) to V; R ← ∅;<br/>"
        "<b>foreach</b> call expression c in AST(M) <b>do</b><br/>"
        "&nbsp;&nbsp;<b>if</b> c is router.VERB(path, mw…, h) <b>then</b><br/>"
        "&nbsp;&nbsp;&nbsp;&nbsp;add (VERB, norm(π · path), mw, h) to R;<br/>"
        "&nbsp;&nbsp;<b>else if</b> c is app.use(prefix, child) <b>then</b><br/>"
        "&nbsp;&nbsp;&nbsp;&nbsp;M′ ← resolve child via imports;<br/>"
        "&nbsp;&nbsp;&nbsp;&nbsp;R ← R ∪ ResolveRoutes(M′, norm(π · prefix), V);<br/>"
        "&nbsp;&nbsp;<b>end</b><br/>"
        "<b>end</b><br/>"
        "<b>return</b> R"
    )
    t_alg = Table([[Paragraph(algo1_code, code_style)]], colWidths=[COL_W])
    t_alg.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#f8fafc')),
        ('BOX', (0,0), (-1,-1), 0.5, colors.HexColor('#cbd5e1')),
        ('PADDING', (0,0), (-1,-1), 3),
    ]))
    story.append(t_alg)
    story.append(Paragraph("Algorithm 1: Recursive route and mount resolution.", caption_style))

    story.append(Paragraph(
        "Listing 1 illustrates the result for a single mounted route. Every field of the record originates from syntax and is therefore labelled DETECTED.",
        body_first_style
    ))

    # Listing 1
    l1_code = (
        "app.use('/api/v1', orders);<br/>"
        "// orders.js<br/>"
        "router.post('/orders',<br/>"
        "  requireAuth, create);<br/>"
        "// =&gt; POST /api/v1/orders<br/>"
        "//    middleware: requireAuth<br/>"
        "//    handler: create [DETECTED]"
    )
    t_l1 = Table([[Paragraph(l1_code, code_style)]], colWidths=[COL_W])
    t_l1.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#f1f5f9')),
        ('BOX', (0,0), (-1,-1), 0.5, colors.HexColor('#94a3b8')),
        ('PADDING', (0,0), (-1,-1), 3),
    ]))
    story.append(t_l1)
    story.append(Paragraph("Listing 1: Mounted route and the extracted record.", caption_style))

    story.append(Paragraph("4.3.3 Controller Analysis", h3_style))
    story.append(Paragraph(
        "Handlers are resolved from inline functions or imported controller modules. For each handler the analyzer records destructuring and member access on req.params, req.query and req.body, which yields parameter names and their location, and collects the arguments of res.status and res.sendStatus calls, which yields the status codes that the handler can return. Because these facts come directly from syntax they are classified DETECTED. Types and constraints that cannot be read from syntax are not guessed by the engine; they are left to the reasoning layer, where they are labelled INFERRED.",
        body_first_style
    ))

    story.append(Paragraph("4.3.4 ORM Model Extraction", h3_style))
    story.append(Paragraph(
        "The database analyzer reads Prisma schema files, Sequelize model definitions and Mongoose schemas and extracts entities, fields, keys and relations into a common representation. This representation feeds the Mermaid [57] ER diagram and gives the CI/CD pipeline flow its edges from endpoints to the data entities they touch.",
        body_first_style
    ))

    story.append(Paragraph("4.4 Grounded AI Reasoning", h2_style))
    story.append(Paragraph(
        "The reasoning layer receives the normalised model rather than raw repository text. A provider abstraction supports Gemini, OpenAI and Claude and falls back to an offline heuristic engine that needs no API key. The layer adds business purpose, plain-language descriptions, error explanations and edge cases. Two rules limit hallucination. First, deterministic facts such as paths, verbs, parameters, status codes and middleware are copied from Stage 2 and tagged DETECTED; the model can neither add nor remove them. Second, everything the model contributes is tagged INFERRED and carries a citation to the file and line that supports it. The same discipline governs the chat assistant which, in the spirit of retrieval-augmented generation [48], [49], answers questions from the model and source excerpts and returns the file and line of each supporting item.",
        body_first_style
    ))

    story.append(Paragraph("4.5 Artifact Generation", h2_style))
    story.append(Paragraph(
        "Table 4 lists the artifacts. All generators read the same knowledge model, so they stay mutually consistent, and re-running the analysis after a code change regenerates every artifact, which supports living documentation. The OpenAPI output follows version 3.0.3 of the specification [58] and the Postman output follows collection format v2.1.0 [59]; the CI/CD pipeline flow is rendered with React Flow [60].",
        body_first_style
    ))

    # Table 4
    story.append(Paragraph("Table 4: Artifacts generated from the knowledge model.", table_caption_style))
    t4_data = [
        [Paragraph("<b>Artifact</b>", th_style), Paragraph("<b>Format</b>", th_style), Paragraph("<b>Derived from</b>", th_style)],
        [Paragraph("API docs", td_style), Paragraph("OpenAPI 3.0.3, Swagger UI", td_style), Paragraph("Routes, params, statuses", td_style)],
        [Paragraph("Postman", td_style), Paragraph("Collection v2.1.0 JSON", td_style), Paragraph("Routes, parameters", td_style)],
        [Paragraph("CI/CD pipeline", td_style), Paragraph("React Flow", td_style), Paragraph("Route, controller, model links", td_style)],
        [Paragraph("Database", td_style), Paragraph("Mermaid ER", td_style), Paragraph("ORM models", td_style)],
        [Paragraph("Security", td_style), Paragraph("Findings list", td_style), Paragraph("Middleware chains, handlers", td_style)],
        [Paragraph("Test suite", td_style), Paragraph("Jest and Supertest", td_style), Paragraph("Routes, observed status codes", td_style)],
        [Paragraph("Playground", td_style), Paragraph("HTTP console (SSRF guard)", td_style), Paragraph("OpenAPI model", td_style)],
    ]
    tab4 = Table(t4_data, colWidths=[55, 75, 82])
    tab4.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#e2e8f0')),
        ('BOX', (0,0), (-1,-1), 0.5, colors.HexColor('#64748b')),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor('#cbd5e1')),
        ('PADDING', (0,0), (-1,-1), 2),
    ]))
    story.append(tab4)

    story.append(Paragraph("4.6 Security Scanner, Tests and Playground", h2_style))
    story.append(Paragraph(
        "The static security scanner flags broken authentication, that is state-changing routes without authentication middleware in their chain, missing input validation, and injection-prone patterns. These categories correspond to entries of the OWASP API Security Top 10 [54]. The test generator emits one Jest [61] and Supertest case per route with the observed status codes as expected outcomes. The playground lets the user send requests to a chosen target from the dashboard; SSRF guardrails prevent the console from being used to reach internal network resources.",
        body_first_style
    ))

    story.append(Paragraph("4.7 Data Flow", h2_style))
    story.append(Paragraph(
        "Figure 2 presents the data flow in data flow diagram notation [62], [63]: rectangles denote external entities, circles processes and open rectangles data stores. At Level 0 the platform is a single process between the developer, who supplies a ZIP file or a Git URL, and the dashboard that returns the results. Figure 2 decomposes it at Level 1 into ingestion (1.0), framework detection (2.0), AST analysis (3.0, comprising route extraction 3.1, controller analysis 3.2 and database analysis 3.3), AI reasoning (4.0) and artifact generation (5.0). Data store D1 holds the normalised knowledge model and D2 to D5 hold the generated artifacts.",
        body_first_style
    ))

    if os.path.exists("fig2_data_flow_diagram.png"):
        story.append(Image("fig2_data_flow_diagram.png", width=COL_W, height=COL_W * 8.5 / 6.0))
        story.append(Paragraph("Figure 2: Level-1 data flow diagram of the platform.", caption_style))

    # Section 5
    story.append(Paragraph("5 IMPLEMENTATION", h1_style))
    story.append(Paragraph(
        "Table 5 summarises the technology stack. The client is a React 18 single-page application built with Vite and TypeScript; the server is written in TypeScript on Node.js 18 or later (tested on Node 24 LTS) with Express. Persistence uses PostgreSQL through a connection pool and falls back automatically to a local JSON store, so that the platform runs on a laptop without set-up. The whole stack consists of free and open-source software and the offline reasoning provider needs no paid key, so the running cost is zero. A machine with an Intel Core i5, AMD Ryzen 5 or Apple Silicon processor, 8 GB of RAM (16 GB for large workspaces) and 2 GB of storage is sufficient.",
        body_first_style
    ))

    # Table 5
    story.append(Paragraph("Table 5: Technology stack.", table_caption_style))
    t5_data = [
        [Paragraph("<b>Layer</b>", th_style), Paragraph("<b>Technologies</b>", th_style)],
        [Paragraph("Client", td_style), Paragraph("React 18, Vite, TypeScript, Tailwind, React Flow, swagger-ui-react, mermaid.js, Router", td_style)],
        [Paragraph("Server", td_style), Paragraph("Node.js, Express, TypeScript, adm-zip, yaml, axios", td_style)],
        [Paragraph("AST engine", td_style), Paragraph("Babel parser, traverse and types", td_style)],
        [Paragraph("Storage", td_style), Paragraph("PostgreSQL with JSON-file fallback", td_style)],
        [Paragraph("AI layer", td_style), Paragraph("Pluggable: Gemini, OpenAI, Claude, offline heuristics", td_style)],
    ]
    tab5 = Table(t5_data, colWidths=[65, 147])
    tab5.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#e2e8f0')),
        ('BOX', (0,0), (-1,-1), 0.5, colors.HexColor('#64748b')),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor('#cbd5e1')),
        ('PADDING', (0,0), (-1,-1), 2),
    ]))
    story.append(tab5)

    story.append(Paragraph(
        "The system was developed in about 200 engineering hours over eight weeks in six phases: foundation and architecture; ingestion and the AST engine; database analysis and the intermediate model; generators and visualisations; security, tests, playground and AI chat; and evaluation with a demonstration.",
        body_style
    ))

    # Section 6
    story.append(Paragraph("6 EVALUATION", h1_style))
    story.append(Paragraph("6.1 Experimental Setup", h2_style))
    story.append(Paragraph(
        "The platform was applied to a demonstration backend, a multi-layered e-commerce and authentication REST API written for Node.js and Express and distributed with the project (examples/demo-api). The ground truth is the set of routes obtained by manually reading the source, including nested mounts. The analysis consists of a single run on the unmodified source. For RQ1 the route coverage is defined in Equation (2):",
        body_first_style
    ))

    eq2_data = [[
        Paragraph("RC = |<i>R</i><sub>det</sub> ∩ <i>R</i><sub>gt</sub>| / |<i>R</i><sub>gt</sub>| × 100%", ParagraphStyle('Eq2', fontName='Times-Italic', fontSize=10, leading=12, alignment=TA_CENTER)),
        Paragraph("(2)", ParagraphStyle('EqN2', fontName='Times-Roman', fontSize=10, leading=12, alignment=TA_RIGHT))
    ]]
    t_eq2 = Table(eq2_data, colWidths=[175, 37])
    t_eq2.setStyle(TableStyle([('VALIGN', (0,0), (-1,-1), 'MIDDLE'), ('PADDING', (0,0), (-1,-1), 0), ('TOPPADDING', (0,0), (-1,-1), 4), ('BOTTOMPADDING', (0,0), (-1,-1), 4)]))
    story.append(t_eq2)

    story.append(Paragraph(
        "where Rdet is the set of routes reported by the engine and Rgt the ground truth. For RQ2 the host-execution count HE is the number of processes spawned or packages installed on repository content; the target value is zero. For RQ3 the number of artifact types of Table 4 that the run produced is counted.",
        body_first_style
    ))

    story.append(Paragraph("6.2 Results", h2_style))
    story.append(Paragraph(
        "Table 6 summarises the outcome. RQ1: the engine discovered every route of the ground truth, so RC = 100%, including nested routes for which the prefix concatenation of Equation (1) produced the full path. RQ2: the analysis consisted of file reads and AST parsing only, and no repository code was executed; HE = 0. RQ3: the single run produced all seven artifact types of Table 4, which were exposed in the dashboard. Parameters and status codes observed in handlers appear in the specification as DETECTED, whereas explanatory text is labelled INFERRED with citations.",
        body_first_style
    ))

    # Table 6
    story.append(Paragraph("Table 6: Summary of results on the demonstration backend.", table_caption_style))
    t6_data = [
        [Paragraph("<b>RQ</b>", th_style), Paragraph("<b>Metric</b>", th_style), Paragraph("<b>Result</b>", th_style)],
        [Paragraph("RQ1", td_style), Paragraph("Route coverage RC", td_style), Paragraph("100%", td_style)],
        [Paragraph("RQ2", td_style), Paragraph("Host executions HE", td_style), Paragraph("0", td_style)],
        [Paragraph("RQ3", td_style), Paragraph("Artifact types generated", td_style), Paragraph("7 of 7", td_style)],
        [Paragraph("RQ4", td_style), Paragraph("Onboarding time, INFERRED accuracy", td_style), Paragraph("Not yet evaluated", td_style)],
    ]
    tab6 = Table(t6_data, colWidths=[40, 112, 60])
    tab6.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#e2e8f0')),
        ('BOX', (0,0), (-1,-1), 0.5, colors.HexColor('#64748b')),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor('#cbd5e1')),
        ('PADDING', (0,0), (-1,-1), 2),
    ]))
    story.append(tab6)

    story.append(Paragraph("6.3 Discussion", h2_style))
    story.append(Paragraph(
        "The results indicate that a syntax-directed engine is sufficient to recover the route surface of a conventionally structured Express backend without annotations, which is the main difference from annotation-based generators [15], and that zero-execution analysis is achievable in practice. The separation of DETECTED and INFERRED statements lets a reviewer concentrate verification effort on the inferred part, which addresses the concern that analysis output is hard to act upon [31]. The expectation that onboarding time falls markedly, with a project target of more than 60%, remains a hypothesis (RQ4) until a user study has been carried out.",
        body_first_style
    ))

    # Section 7
    story.append(Paragraph("7 THREATS TO VALIDITY", h1_style))
    story.append(Paragraph(
        "The threats are discussed along the categories of Wohlin et al. [64]. Construct validity: RC measures route discovery only; the correctness of parameters, schemas and descriptions is not covered, and the ground truth was derived manually by the authors, so errors in it would affect RC. Internal validity: the DETECTED part is deterministic, but the INFERRED part depends on the language model and may vary between runs and providers. External validity: a single backend authored within the project and a single framework were used; repositories that register routes dynamically, for instance in loops, from computed paths or through plugins, cannot be fully resolved by static analysis and are untested. Conclusion validity: with one case no statistical inference is possible and the results are descriptive. There is also no baseline comparison with annotation-based generators or LLM-only approaches. A benchmark of open-source Express projects with ground-truth routes and a controlled study with developers are the next steps.",
        body_first_style
    ))

    # Section 8
    story.append(Paragraph("8 CONCLUSIONS AND FUTURE WORK", h1_style))
    story.append(Paragraph(
        "This paper presented the AI API Reverse-Engineering Platform, developed and evaluated as a design science artifact. It recovers the API surface of a backend repository by static AST analysis, enriches it with a grounded reasoning layer and generates documentation, specifications, graphs, security findings and tests from one knowledge model without executing the analysed code. On the demonstration backend it achieved complete route coverage (RQ1), executed no repository code (RQ2) and produced all seven artifact types in one run (RQ3). The explicit separation of DETECTED facts from INFERRED statements, with file and line citations, is the central mechanism against hallucination.",
        body_first_style
    ))
    story.append(Paragraph(
        "Future work covers plugin analyzers for Fastify, NestJS, Django, FastAPI, Spring Boot and Laravel, webhook-driven re-analysis for continuous documentation, an evaluation on a benchmark of open-source repositories with a quantitative comparison to baselines, and a user study that measures onboarding time (RQ4) and the rate of hallucinated statements.",
        body_style
    ))

    # References
    story.append(Paragraph("REFERENCES", h1_style))
    references_list = [
        "[1] R. T. Fielding, “Architectural styles and the design of network-based software architectures,” Ph.D. dissertation, Dept. Inf. Comput. Sci., Univ. California, Irvine, CA, USA, 2000.",
        "[2] L. Richardson, M. Amundsen, and S. Ruby, RESTful Web APIs. Sebastopol, CA, USA: O’Reilly Media, 2013.",
        "[3] S. Newman, Building Microservices, 2nd ed. Sebastopol, CA, USA: O’Reilly Media, 2021.",
        "[4] J. Soldani, D. A. Tamburri, and W.-J. van den Heuvel, “The pains and gains of microservices: A systematic grey literature review,” J. Syst. Softw., vol. 146, pp. 215–232, 2018.",
        "[5] P. Di Francesco, P. Lago, and I. Malavolta, “Migrating towards microservice architectures: An industrial survey,” in Proc. IEEE Int. Conf. Softw. Archit. (ICSA), 2018, pp. 29–39.",
        "[6] G. Uddin and M. P. Robillard, “How API documentation fails,” IEEE Softw., vol. 32, no. 4, pp. 68–75, Jul./Aug. 2015.",
        "[7] W. Maalej and M. P. Robillard, “Patterns of knowledge in API reference documentation,” IEEE Trans. Softw. Eng., vol. 39, no. 9, pp. 1264–1282, Sep. 2013.",
        "[8] A. Forward and T. C. Lethbridge, “The relevance of software documentation, tools and technologies: A survey,” in Proc. ACM Symp. Document Eng. (DocEng), 2002, pp. 26–33.",
        "[9] J. Zhi, V. Garousi-Yusifoğlu, B. Sun, G. Garousi, S. Shahnewaz, and G. Ruhe, “Cost, benefits and quality of software development documentation: A systematic mapping,” J. Syst. Softw., vol. 99, pp. 175–198, 2015.",
        "[10] I. Steinmacher, M. A. G. Silva, M. A. Gerosa, and D. F. Redmiles, “A systematic literature review on the barriers faced by newcomers to open source software projects,” Inf. Softw. Technol., vol. 59, pp. 67–85, 2015.",
        "[11] V. Atlidakis, P. Godefroid, and M. Polishchuk, “RESTler: Stateful REST API fuzzing,” in Proc. IEEE/ACM 41st Int. Conf. Softw. Eng. (ICSE), 2019, pp. 748–758.",
        "[12] A. Arcuri, “RESTful API automated test case generation with EvoMaster,” ACM Trans. Softw. Eng. Methodol., vol. 28, no. 1, pp. 3:1–3:37, 2019.",
        "[13] M. Kim, Q. Xin, S. Sinha, and A. Orso, “Automated test generation for REST APIs: No time to rest yet,” in Proc. 31st ACM SIGSOFT Int. Symp. Softw. Testing Anal. (ISSTA), 2022, pp. 289–301.",
        "[14] A. Golmohammadi, M. Zhang, and A. Arcuri, “Testing RESTful APIs: A survey,” ACM Trans. Softw. Eng. Methodol., vol. 33, no. 1, pp. 27:1–27:41, 2023.",
        "[15] A. Lercher, C. Macho, C. Bauer, and M. Pinzger, “Generating accurate OpenAPI descriptions from Java source code,” arXiv:2410.23873, 2024.",
        "[16] M. P. Robillard, E. Bodden, D. Kawrykow, M. Mezini, and T. Ratchford, “Automated API property inference techniques,” IEEE Trans. Softw. Eng., vol. 39, no. 5, pp. 613–637, May 2013.",
        "[17] M. Chen et al., “Evaluating large language models trained on code,” arXiv:2107.03374, 2021.",
        "[18] X. Hou et al., “Large language models for software engineering: A systematic literature review,” ACM Trans. Softw. Eng. Methodol., vol. 33, no. 8, pp. 1–79, 2024.",
        "[19] Z. Ji et al., “Survey of hallucination in natural language generation,” ACM Comput. Surv., vol. 55, no. 12, pp. 248:1–248:38, 2023.",
        "[20] L. Huang et al., “A survey on hallucination in large language models: Principles, taxonomy, challenges, and open questions,” ACM Trans. Inf. Syst., vol. 43, no. 2, pp. 1–55, 2025.",
        "[21] A. R. Hevner, S. T. March, J. Park, and S. Ram, “Design science in information systems research,” MIS Quart., vol. 28, no. 1, pp. 75–105, 2004.",
        "[22] K. Peffers, T. Tuunanen, M. A. Rothenberger, and S. Chatterjee, “A design science research methodology for information systems research,” J. Manage. Inf. Syst., vol. 24, no. 3, pp. 45–77, 2007.",
        "[23] E. Wittern et al., “Statically checking web API requests in JavaScript,” in Proc. IEEE/ACM 39th Int. Conf. Softw. Eng. (ICSE), 2017, pp. 244–254.",
        "[24] T. Le, T. Tran, D. Cao, V. Le, T. N. Nguyen, and V. Nguyen, “KAT: Dependency-aware automated API testing with large language models,” in Proc. IEEE Conf. Softw. Testing, Verification Validation (ICST), 2024, pp. 82–92.",
        "[25] S. H. Jensen, A. Møller, and P. Thiemann, “Type analysis for JavaScript,” in Proc. Int. Static Anal. Symp. (SAS), 2009, pp. 238–255.",
        "[26] M. Madsen, B. Livshits, and M. Fanning, “Practical static analysis of JavaScript applications in the presence of frameworks and libraries,” in Proc. 9th Joint Meeting Found. Softw. Eng. (ESEC/FSE), 2013, pp. 499–509.",
        "[27] E. Andreasen et al., “A survey of dynamic analysis and test generation for JavaScript,” ACM Comput. Surv., vol. 50, no. 5, pp. 66:1–66:36, 2017.",
        "[28] A. V. Aho, M. S. Lam, R. Sethi, and J. D. Ullman, Compilers: Principles, Techniques, and Tools, 2nd ed. Boston, MA, USA: Addison-Wesley, 2006.",
        "[29] Babel Team, “Babel: The compiler for next generation JavaScript,” 2024. [Online]. Available: https://babeljs.io",
        "[30] F. Nielson, H. R. Nielson, and C. Hankin, Principles of Program Analysis. Berlin, Germany: Springer, 1999.",
        "[31] B. Johnson, Y. Song, E. Murphy-Hill, and R. Bowdidge, “Why don’t software developers use static analysis tools to find bugs?” in Proc. 35th Int. Conf. Softw. Eng. (ICSE), 2013, pp. 672–681.",
        "[32] C. Sadowski, E. Aftandilian, A. Eagle, L. Miller-Cushon, and C. Jaspan, “Lessons from building static analysis tools at Google,” Commun. ACM, vol. 61, no. 4, pp. 58–66, 2018.",
        "[33] H. Javed, F. Ali, B. Shah, and D. Kwak, “Binary code analysis for cybersecurity: A systematic review of forensic techniques in vulnerability detection and anti-evasion strategies,” IEEE Access, vol. 13, pp. 167139–167164, 2025.",
        "[34] D. Suo, L. Xue, L. Yu, R. Tan, W. Huang, and G. Sun, “ARAP: Demystifying anti runtime analysis code in Android apps,” IEEE Trans. Softw. Eng., vol. 51, no. 10, pp. 2787–2803, Oct. 2025.",
        "[35] A. Norby, B. P. Rimal, and B. Brizendine, “Measurement of anti-debugging techniques on Windows and Linux for Intel x86-64,” IEEE Access, vol. 13, pp. 46568–46583, 2025.",
        "[36] S. T. Padhy, P. B. Shanthi, G. Bijur, and S. Hemalatha, “A threat-informed approach to malware evasion using DRM and TLS callbacks,” IEEE Access, vol. 13, pp. 155195–155202, 2025.",
        "[37] F. Kurniawan, D. Stiawan, D. Antoni, M. Y. Idris, and R. Budiarto, “A robust and efficient machine learning framework for early detection of Android malware,” IEEE Access, vol. 13, pp. 127183–127220, 2025.",
        "[38] M. Bartłomiejczyk, I. El Fray, and F. Kamoun, “Enhancing two-factor authentication security by analyzing SMS OTP-interception in Android malware,” IEEE Access, vol. 13, pp. 185926–185942, 2025.",
        "[39] Z. Morić, V. Dakić, and A. Kapulica, “An in-depth exploration of malware persistence: Reverse engineering, defense, and simulation,” IEEE Access, vol. 14, pp. 37384–37397, 2026.",
        "[40] A. Vaswani et al., “Attention is all you need,” in Proc. Adv. Neural Inf. Process. Syst. (NeurIPS), vol. 30, 2017, pp. 5998–6008.",
        "[41] Z. Feng et al., “CodeBERT: A pre-trained model for programming and natural languages,” in Findings Assoc. Comput. Linguistics: EMNLP, 2020, pp. 1536–1547.",
        "[42] T. B. Brown et al., “Language models are few-shot learners,” in Proc. Adv. Neural Inf. Process. Syst. (NeurIPS), vol. 33, 2020, pp. 1877–1901.",
        "[43] A. Fan et al., “Large language models for software engineering: Survey and open problems,” in Proc. IEEE/ACM Int. Conf. Softw. Eng.: Future Softw. Eng. (ICSE-FoSE), 2023, pp. 31–53.",
        "[44] Q. Luo et al., “RepoAgent: An LLM-powered open-source framework for repository-level code documentation generation,” arXiv:2402.16667, 2024.",
        "[45] X. Hu, Z. Fu, S. Xie, S. H. H. Ding, and P. Charland, “SoK: Potentials and challenges of large language models for reverse engineering,” arXiv:2509.21821, 2025.",
        "[46] H. A. Siala and K. Lano, “Towards using LLMs in the reverse engineering of software systems to object constraint language,” in Proc. IEEE Int. Conf. Softw. Anal., Evol. Reengineering (SANER), 2025, pp. 1–6.",
        "[47] A. Boronat and J. Mustafa, “MDRE-LLM: A tool for analyzing and applying LLMs in software reverse engineering,” in Proc. IEEE Int. Conf. Softw. Anal., Evol. Reengineering (SANER), 2025, pp. 850–854.",
        "[48] P. Lewis et al., “Retrieval-augmented generation for knowledge-intensive NLP tasks,” in Proc. Adv. Neural Inf. Process. Syst. (NeurIPS), vol. 33, 2020, pp. 9459–9474.",
        "[49] Y. Gao et al., “Retrieval-augmented generation for large language models: A survey,” arXiv:2312.10997, 2023.",
        "[50] H. Pearce, B. Ahmad, B. Tan, B. Dolan-Gavitt, and R. Karri, “Asleep at the keyboard? Assessing the security of GitHub Copilot’s code contributions,” in Proc. IEEE Symp. Secur. Privacy (SP), 2022, pp. 754–768.",
        "[51] C. E. Jimenez et al., “SWE-bench: Can language models resolve real-world GitHub issues?” in Proc. Int. Conf. Learn. Represent. (ICLR), 2024.",
        "[52] P. Runeson and M. Höst, “Guidelines for conducting and reporting case study research in software engineering,” Empirical Softw. Eng., vol. 14, no. 2, pp. 131–164, 2009.",
        "[53] V. R. Basili, G. Caldiera, and H. D. Rombach, “The goal question metric approach,” in Encyclopedia of Software Engineering, vol. 1. New York, NY, USA: Wiley, 1994, pp. 528–532.",
        "[54] OWASP Foundation, “OWASP API security top 10 – 2023,” 2023. [Online]. Available: https://owasp.org/API-Security/",
        "[55] Snyk, “Zip Slip vulnerability,” 2018. [Online]. Available: https://security.snyk.io/research/zip-slip-vulnerability",
        "[56] OpenJS Foundation, “Express: Fast, unopinionated, minimalist web framework for Node.js,” 2024. [Online]. Available: https://expressjs.com",
        "[57] Mermaid contributors, “Mermaid: Diagramming and charting tool,” 2024. [Online]. Available: https://mermaid.js.org",
        "[58] OpenAPI Initiative, “OpenAPI Specification v3.0.3,” 2021. [Online]. Available: https://spec.openapis.org/oas/v3.0.3",
        "[59] Postman, “Collection format v2.1.0,” 2021. [Online]. Available: https://schema.postman.com/",
        "[60] xyflow, “React Flow: A library for building node-based user interfaces,” 2024. [Online]. Available: https://reactflow.dev",
        "[61] OpenJS Foundation, “Jest: Delightful JavaScript testing,” 2024. [Online]. Available: https://jestjs.io",
        "[62] T. DeMarco, Structured Analysis and System Specification. New York, NY, USA: Yourdon Press, 1978.",
        "[63] C. Gane and T. Sarson, Structured Systems Analysis: Tools and Techniques. Englewood Cliffs, NJ, USA: Prentice-Hall, 1979.",
        "[64] C. Wohlin et al., Experimentation in Software Engineering. Berlin, Germany: Springer, 2012."
    ]

    for ref in references_list:
        story.append(Paragraph(ref, ref_style))

    doc.build(story, canvasmaker=ScitepressNumberedCanvas)
    print(f"✅ Successfully compiled EXACT SCITEPRESS PDF: {filename}")

if __name__ == "__main__":
    generate_exact_scitepress_pdf()
