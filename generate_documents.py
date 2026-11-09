import docx
from docx.shared import Inches, Pt, Cm, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_LINE_SPACING
from docx.enum.section import WD_SECTION
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_ALIGN_VERTICAL
from docx.oxml import OxmlElement, parse_xml
from docx.oxml.ns import qn, nsdecls

import reportlab
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm, cm
from reportlab.lib import colors
from reportlab.platypus import (
    BaseDocTemplate, PageTemplate, Frame, Paragraph, Spacer, FrameBreak,
    NextPageTemplate, Table as RLTable, TableStyle, Preformatted, KeepTogether
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY, TA_LEFT, TA_RIGHT

def set_cell_margins(cell, top=100, bottom=100, left=150, right=150):
    tcPr = cell._tc.get_or_add_tcPr()
    tcMar = OxmlElement('w:tcMar')
    for m, val in [('top', top), ('bottom', bottom), ('left', left), ('right', right)]:
        node = OxmlElement(f'w:{m}')
        node.set(qn('w:w'), str(val))
        node.set(qn('w:type'), 'dxa')
        tcMar.append(node)
    tcPr.append(tcMar)

def set_table_borders(table):
    tblPr = table._tbl.tblPr
    borders = parse_xml(
        f'<w:tblBorders {nsdecls("w")}>\n'
        f'  <w:top w:val="single" w:sz="6" w:space="0" w:color="000000"/>\n'
        f'  <w:bottom w:val="single" w:sz="6" w:space="0" w:color="000000"/>\n'
        f'  <w:insideH w:val="single" w:sz="4" w:space="0" w:color="CCCCCC"/>\n'
        f'  <w:insideV w:val="none"/>\n'
        f'  <w:left w:val="none"/>\n'
        f'  <w:right w:val="none"/>\n'
        f'</w:tblBorders>'
    )
    tblPr.append(borders)

def build_docx(filename):
    doc = docx.Document()
    
    # Page setup for Section 1 (A4, SCITEPRESS margins)
    sec1 = doc.sections[0]
    sec1.page_width = Cm(21.0)
    sec1.page_height = Cm(29.7)
    sec1.top_margin = Cm(3.3)
    sec1.bottom_margin = Cm(4.2)
    sec1.left_margin = Cm(2.6)
    sec1.right_margin = Cm(2.6)
    sec1.header_distance = Cm(1.4)
    sec1.footer_distance = Cm(2.5)

    # Styles
    # Normal / Body
    style_normal = doc.styles['Normal']
    style_normal.font.name = 'Times New Roman'
    style_normal.font.size = Pt(10)
    style_normal.font.color.rgb = RGBColor(0, 0, 0)
    style_normal.paragraph_format.line_spacing = 1.0
    style_normal.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY

    # Title
    p_title = doc.add_paragraph()
    p_title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_title.paragraph_format.line_spacing = Pt(17)
    p_title.paragraph_format.space_before = Pt(0)
    p_title.paragraph_format.space_after = Pt(24)
    run_title = p_title.add_run('AI API Reverse-Engineering Platform: Zero-Execution AST Analysis with Grounded LLM Reasoning for Automated API Documentation')
    run_title.font.name = 'Times New Roman'
    run_title.font.size = Pt(15)
    run_title.font.bold = True

    # Authors
    p_auth = doc.add_paragraph()
    p_auth.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_auth.paragraph_format.line_spacing = Pt(13)
    p_auth.paragraph_format.space_before = Pt(0)
    p_auth.paragraph_format.space_after = Pt(6)
    
    authors = [
        ('Nagesh Pawar', '1 a'),
        ('Akash More', '1 b'),
        ('Ritesh Shinde', '1 c'),
        ('Sangram Karanjawane', '1 d and'),
        ('Sumit Patil', '1 e')
    ]
    for i, (name, sup) in enumerate(authors):
        r_name = p_auth.add_run(name)
        r_name.font.name = 'Times New Roman'
        r_name.font.size = Pt(11)
        r_sup = p_auth.add_run(f' {sup}' if i == len(authors)-1 else f' {sup}, ')
        r_sup.font.name = 'Times New Roman'
        r_sup.font.size = Pt(8)
        r_sup.font.superscript = True

    # Affiliations
    p_aff = doc.add_paragraph()
    p_aff.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_aff.paragraph_format.line_spacing = Pt(11)
    p_aff.paragraph_format.space_before = Pt(0)
    p_aff.paragraph_format.space_after = Pt(2)
    r_aff_num = p_aff.add_run('1 ')
    r_aff_num.font.name = 'Times New Roman'
    r_aff_num.font.size = Pt(7)
    r_aff_num.font.superscript = True
    r_aff = p_aff.add_run('Department of Electronics and Computer Engineering, Zeal College of Engineering and Research, Pune, India')
    r_aff.font.name = 'Times New Roman'
    r_aff.font.size = Pt(9)
    r_aff.font.italic = True

    # Email
    p_em = doc.add_paragraph()
    p_em.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_em.paragraph_format.line_spacing = Pt(11)
    p_em.paragraph_format.space_before = Pt(0)
    p_em.paragraph_format.space_after = Pt(28)
    r_em = p_em.add_run('{nageshpawar2902, sumit.patil}@zealeducation.com')
    r_em.font.name = 'Times New Roman'
    r_em.font.size = Pt(9)
    r_em.font.italic = True

    # Keywords
    p_kw = doc.add_paragraph()
    p_kw.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    p_kw.paragraph_format.line_spacing = Pt(11)
    p_kw.paragraph_format.left_indent = Cm(2.0)
    p_kw.paragraph_format.right_indent = Cm(0)
    p_kw.paragraph_format.space_before = Pt(12)
    p_kw.paragraph_format.space_after = Pt(12)
    r_kw_label = p_kw.add_run('Keywords:\t')
    r_kw_label.font.name = 'Times New Roman'
    r_kw_label.font.size = Pt(9)
    r_kw_label.font.bold = True
    r_kw_body = p_kw.add_run('API Reverse Engineering, Static Analysis, Abstract Syntax Tree, OpenAPI, Large Language Models, Design Science, DevSecOps.')
    r_kw_body.font.name = 'Times New Roman'
    r_kw_body.font.size = Pt(9)

    # Abstract
    p_ab = doc.add_paragraph()
    p_ab.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    p_ab.paragraph_format.line_spacing = Pt(11)
    p_ab.paragraph_format.left_indent = Cm(2.0)
    p_ab.paragraph_format.right_indent = Cm(0)
    p_ab.paragraph_format.space_before = Pt(6)
    p_ab.paragraph_format.space_after = Pt(24)
    r_ab_label = p_ab.add_run('Abstract:\t')
    r_ab_label.font.name = 'Times New Roman'
    r_ab_label.font.size = Pt(9)
    r_ab_label.font.bold = True
    r_ab_body = p_ab.add_run('Backend repositories are often inherited with little or no API documentation, and recovering the contract of an API by hand is slow and error-prone. This paper follows a design science approach to build and evaluate the AI API Reverse-Engineering Platform, which ingests a ZIP archive or a public GitHub repository and recovers the API surface without executing the untrusted code. A deterministic abstract syntax tree (AST) engine resolves routes, mount prefixes, middleware, parameters, status codes and ORM schemas, and a grounded reasoning layer based on large language models adds business intent while labelling each statement as detected or inferred with a file and line citation. A single normalised model drives OpenAPI 3.0 specifications, Postman collections, dependency graphs, ER diagrams, security audits, Jest and Supertest suites and an SSRF-protected playground. Evaluated through three research questions on an e-commerce and authentication demonstration backend, the engine discovered all routes (RC = 100%), executed no repository code and produced all seven artifact types in one run. The study is limited to one backend and one framework; broader benchmarks and a user study are planned.')
    r_ab_body.font.name = 'Times New Roman'
    r_ab_body.font.size = Pt(9)

    # SECTION 2: Two Columns
    sec2 = doc.add_section(WD_SECTION.CONTINUOUS)
    sec2.top_margin = Cm(3.3)
    sec2.bottom_margin = Cm(4.2)
    sec2.left_margin = Cm(2.6)
    sec2.right_margin = Cm(2.6)
    sectPr = sec2._sectPr
    cols = sectPr.xpath('./w:cols')
    if cols:
        cols[0].set(qn('w:num'), '2')
        cols[0].set(qn('w:space'), '454') # 0.8 cm in twips
    else:
        c = OxmlElement('w:cols')
        c.set(qn('w:num'), '2')
        c.set(qn('w:space'), '454')
        sectPr.append(c)

    def add_h1(text, is_first=False):
        p = doc.add_paragraph()
        p.alignment = WD_ALIGN_PARAGRAPH.LEFT
        p.paragraph_format.line_spacing = Pt(15)
        p.paragraph_format.space_before = Pt(0 if is_first else 24)
        p.paragraph_format.space_after = Pt(12)
        r = p.add_run(text)
        r.font.name = 'Times New Roman'
        r.font.size = Pt(13)
        r.font.bold = True
        return p

    def add_h2(text, right_after_h1=False):
        p = doc.add_paragraph()
        p.alignment = WD_ALIGN_PARAGRAPH.LEFT
        p.paragraph_format.line_spacing = Pt(13)
        p.paragraph_format.space_before = Pt(4 if right_after_h1 else 11)
        p.paragraph_format.space_after = Pt(11)
        r = p.add_run(text)
        r.font.name = 'Times New Roman'
        r.font.size = Pt(12)
        r.font.bold = True
        return p

    def add_h3(text, right_after_h2=False):
        p = doc.add_paragraph()
        p.alignment = WD_ALIGN_PARAGRAPH.LEFT
        p.paragraph_format.line_spacing = Pt(12)
        p.paragraph_format.space_before = Pt(4 if right_after_h2 else 10)
        p.paragraph_format.space_after = Pt(10)
        r = p.add_run(text)
        r.font.name = 'Times New Roman'
        r.font.size = Pt(11)
        r.font.bold = True
        return p

    def add_p(text, indent=True):
        p = doc.add_paragraph()
        p.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
        p.paragraph_format.line_spacing = 1.0
        p.paragraph_format.first_line_indent = Cm(0.5 if indent else 0.0)
        p.paragraph_format.space_before = Pt(0)
        p.paragraph_format.space_after = Pt(4)
        r = p.add_run(text)
        r.font.name = 'Times New Roman'
        r.font.size = Pt(10)
        return p

    def add_bullet(text):
        p = doc.add_paragraph(style='List Bullet')
        p.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
        p.paragraph_format.line_spacing = 1.0
        p.paragraph_format.space_before = Pt(0)
        p.paragraph_format.space_after = Pt(3)
        r = p.add_run(text)
        r.font.name = 'Times New Roman'
        r.font.size = Pt(10)
        return p

    def add_tbl_caption(text):
        p = doc.add_paragraph()
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p.paragraph_format.space_before = Pt(12)
        p.paragraph_format.space_after = Pt(6)
        r = p.add_run(text)
        r.font.name = 'Times New Roman'
        r.font.size = Pt(9)
        return p

    def add_fig_caption(text):
        p = doc.add_paragraph()
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p.paragraph_format.space_before = Pt(6)
        p.paragraph_format.space_after = Pt(12)
        r = p.add_run(text)
        r.font.name = 'Times New Roman'
        r.font.size = Pt(9)
        return p

    def add_code_block(code_text):
        p = doc.add_paragraph()
        p.alignment = WD_ALIGN_PARAGRAPH.LEFT
        p.paragraph_format.line_spacing = 1.0
        p.paragraph_format.left_indent = Cm(0.3)
        p.paragraph_format.space_before = Pt(4)
        p.paragraph_format.space_after = Pt(4)
        r = p.add_run(code_text)
        r.font.name = 'Courier New'
        r.font.size = Pt(8.5)
        return p

    # --- 1 INTRODUCTION ---
    add_h1('1 INTRODUCTION', is_first=True)
    add_h2('1.1 Background and Motivation', right_after_h1=True)
    add_p('Web APIs are the integration layer of modern software, and REST (Fielding, 2000) remains the dominant style for exposing them (Richardson et al., 2013). In microservice-oriented systems (Newman, 2021; Soldani et al., 2018; Di Francesco et al., 2018) the number of endpoints grows quickly, and routes are added, renamed and re-mounted continuously, while the documents that should describe them are updated late or never. Empirical studies of API documentation report incomplete, ambiguous and outdated content as recurrent problems (Uddin and Robillard, 2015; Maalej and Robillard, 2013), practitioner surveys find that documentation is valued yet frequently out of date (Forward and Lethbridge, 2002), and the cost and benefit of documentation have been studied systematically (Zhi et al., 2015). Poor documentation is also among the barriers reported for newcomers to open-source projects (Steinmacher et al., 2015).', indent=False)
    add_p('For a developer who inherits an undocumented backend, the source code is the only authoritative statement of the API contract, yet recovering it means reading nested router definitions, middleware chains and controllers spread over many files. The consequences are felt downstream: front-end teams guess request and response shapes, testers write collections by hand, and automated REST test generators, which typically consume an OpenAPI description (Atlidakis et al., 2019; Arcuri, 2019; Kim et al., 2022; Golmohammadi et al., 2023), cannot start without an accurate one.', indent=True)
    add_p('Existing automation covers only part of the problem. Annotation-based generators need framework-specific metadata that developers must add beforehand (Lercher et al., 2024), and dynamic approaches need a running system and representative inputs (Robillard et al., 2013). Large language models (LLMs) summarise code fluently (Chen et al., 2021; Hou et al., 2024) but hallucinate when they are not anchored to verifiable evidence (Ji et al., 2023; Huang et al., 2025). The safety of the analysis host is a further concern: a repository is untrusted input, and tools that install dependencies or start the application in order to inspect it execute arbitrary code taken from that repository.', indent=True)

    add_h2('1.2 Research Questions and Contributions')
    add_p('This paper treats the problem as a design science task (Hevner et al., 2004; Peffers et al., 2007): an artifact, the AI API Reverse-Engineering Platform, is built and then evaluated against explicit research questions (RQs):', indent=False)
    add_bullet('RQ1 (completeness): how completely does a zero-execution AST engine recover the route surface of an Express backend?')
    add_bullet('RQ2 (safety): can an untrusted repository be analysed without executing its code on the analysis host?')
    add_bullet('RQ3 (artifact coverage): can the documentation, specification, graph, security and test artifacts be generated from a single knowledge model in one run?')
    add_p('The main contributions of this work are:', indent=False)
    add_bullet('a zero-execution ingestion and AST pipeline that recovers routes, mount prefixes, middleware chains, parameters, status codes and ORM schemas from Node.js and Express projects written in JavaScript or TypeScript;')
    add_bullet('a grounding discipline in which compiler facts are labelled DETECTED and language-model statements are labelled INFERRED with file and line citations, which limits the effect of hallucination;')
    add_bullet('a canonical knowledge model from which OpenAPI, Postman, dependency graphs, ER diagrams, security findings, test suites, an SSRF-protected playground and a citation-backed chat are generated in one dashboard;')
    add_bullet('a structured evaluation of completeness, safety and artifact coverage on a demonstration backend.')
    add_p('The paper is organised as follows. Section 2 reviews related work, Section 3 describes the research methodology, Section 4 presents the system design, Section 5 the implementation, Section 6 the evaluation, Section 7 the threats to validity and Section 8 concludes.', indent=True)

    # --- 2 RELATED WORK ---
    add_h1('2 RELATED WORK')
    add_h2('2.1 API Documentation and Specification Recovery', right_after_h1=True)
    add_p('Inferring API properties from code is an established topic. Robillard et al. (2013) survey static and dynamic techniques that infer properties such as the call ordering of library APIs and show that program analysis can recover constraints without developer annotations. Their focus is in-process libraries, not network-facing endpoints, whose contract is formed by verbs, path templates assembled across files, middleware and payload shapes. Wittern et al. (2017) analyse JavaScript clients statically to check web API requests against specifications; the work shows the value of static reasoning for web APIs but operates on the consumer side and presupposes an existing specification. On the server side, Lercher et al. (2024) generate OpenAPI descriptions from Java source code and compare their accuracy with annotation-driven tools such as springdoc-openapi. This supports the premise that specifications can be derived from code, but the approach is specific to the Java ecosystem.', indent=False)
    add_p('The need for accurate specifications is reinforced by REST testing research. RESTler (Atlidakis et al., 2019), EvoMaster (Arcuri, 2019) and the tools compared by Kim et al. (2022) work from API descriptions, a recent survey (Golmohammadi et al., 2023) organises the field around them, and KAT (Le et al., 2024) adds LLM-based test generation that exploits dependencies between operations. Maalej and Robillard (2013) provide a taxonomy of knowledge types in API reference documentation against which generated documentation can be assessed.', indent=True)

    add_h2('2.2 Static Analysis of JavaScript')
    add_p('Static analysis of JavaScript is difficult because of the dynamic features of the language. Type analysis for JavaScript was an early response (Jensen et al., 2009), later work shows that frameworks and libraries complicate analysis further (Madsen et al., 2013), and a survey of dynamic analysis and test generation for JavaScript (Andreasen et al., 2017) documents the trade-offs between the two families of techniques. The engine presented here therefore does not aim at whole-program soundness. It exploits the fact that Express route registration follows a small set of syntactic idioms, so that a syntax-directed traversal of the abstract syntax tree (Aho et al., 2006; Babel Team, 2024) suffices for the common cases, and it marks what it cannot resolve statically. The theory of such analyses is covered by Nielson et al. (1999).', indent=False)
    add_p('Practical experience also matters. Johnson et al. (2013) found that developers avoid static analysis tools when warnings are false or hard to act upon, and Sadowski et al. (2018) report that analysis at scale succeeded at Google because findings were actionable and integrated into developer workflows. This motivates the DETECTED and INFERRED labels of the platform, which tell the reader how much each statement can be trusted.', indent=True)

    add_h2('2.3 Static and Dynamic Analysis in Security-Oriented Reverse Engineering')
    add_p('Reverse engineering is widely practised in security, where the choice between static and dynamic analysis is a recurring theme. Javed et al. (2025) review 236 papers on binary code analysis and devote one of their six areas to evasion and anti-analysis strategies and their countermeasures. Evasion is common: in 117,270 Android apps, Suo et al. (2025) found that almost all benign (99.6%) and malicious (97.0%) apps implement at least one category of anti-runtime-analysis technique, which can lead to inaccurate analysis results. Norby et al. (2025) measure the performance overhead of six categories of anti-debugging techniques on Windows and Linux, and Padhy et al. (2025) show how binding execution to a machine through DRM fingerprinting and thread-local-storage callbacks thwarts sandbox, virtual-machine and debugger-based analysis.', indent=False)
    add_p('Static approaches remain effective in this setting. Kurniawan et al. (2025) reach 97% accuracy in detecting Android malware from statically extracted features, and Bartłomiejczyk et al. (2025) report that permission-based static analysis still detects SMS-stealing malware under several obfuscation strategies, with a detection rate of almost 70%. Morić et al. (2026) conclude that hybrid analysis that integrates static, dynamic and simulated testing improves detection reliability, but they carry out the dynamic work in controlled environments, which illustrates the cost of executing untrusted code safely. These studies concern binaries and malware rather than API source code. We use them only as evidence for a design principle, namely that the analysis of untrusted artifacts should not depend on running them, and apply that principle to source-level API recovery.', indent=True)

    add_h2('2.4 LLMs for Software Engineering and Documentation')
    add_p('Transformer-based language models (Vaswani et al., 2017) pre-trained on text and code (Chen et al., 2021; Feng et al., 2020; Brown et al., 2020) are now applied across the software engineering lifecycle (Hou et al., 2024; Fan et al., 2023). For documentation, RepoAgent (Luo et al., 2024) generates repository-level documentation with an LLM. For reverse engineering, Hu et al. (2025) systematise LLM-based work and report that retrieval and grounding improve factual accuracy while hallucination and weak reproducibility remain open issues, and Siala and Lano (2025) and Boronat and Mustafa (2025) explore LLMs in model-driven reverse engineering. Hallucination is documented extensively (Ji et al., 2023; Huang et al., 2025), retrieval-augmented generation (Lewis et al., 2020; Gao et al., 2023) is the main mitigation, LLM-written code has been shown to contain security weaknesses (Pearce et al., 2022), and repository-level benchmarks such as SWE-bench (Jimenez et al., 2024) show that tasks requiring an understanding of whole repositories remain hard for language models.', indent=False)

    add_h2('2.5 Summary and Research Gap')
    add_p('Table 1 positions the platform against representative work. Three observations motivate the design. First, each contribution solves one sub-problem, such as specification generation, documentation or testing, whereas developers need the whole set of artifacts in one place. Second, specification generators are tied to one technology stack and, when LLMs are used, the output is rarely separated into verified facts and model conjecture. Third, the safety of the analysis host is seldom treated as a design requirement, although repository analysis necessarily handles untrusted code.', indent=False)

    add_tbl_caption('Table 1: Positioning of this work against related approaches.')
    tbl1 = doc.add_table(rows=7, cols=4)
    tbl1.alignment = WD_TABLE_ALIGNMENT.CENTER
    set_table_borders(tbl1)
    tbl1_data = [
        ['Work', 'Analysis', 'Runs code?', 'Main output'],
        ['Robillard et al. (2013)', 'Survey: static/dynamic', 'Partly', 'Library API properties'],
        ['Wittern et al. (2017)', 'Static, JS clients', 'No', 'Request checks'],
        ['Lercher et al. (2024)', 'Static, Java source', 'No', 'OpenAPI description'],
        ['Luo et al. (2024)', 'LLM, repository level', 'No', 'Code docs'],
        ['Le et al. (2024)', 'LLM, spec driven', 'Yes (live API)', 'API test cases'],
        ['This work', 'AST + grounded LLM', 'No', 'Specs, graphs, tests, audits']
    ]
    for r_idx, row in enumerate(tbl1.rows):
        for c_idx, cell in enumerate(row.cells):
            cell.text = tbl1_data[r_idx][c_idx]
            p = cell.paragraphs[0]
            p.alignment = WD_ALIGN_PARAGRAPH.LEFT
            r = p.runs[0]
            r.font.name = 'Times New Roman'
            r.font.size = Pt(8)
            if r_idx == 0:
                r.font.bold = True
            set_cell_margins(cell, 60, 60, 80, 80)

    # --- 3 RESEARCH METHODOLOGY ---
    add_h1('3 RESEARCH METHODOLOGY')
    add_h2('3.1 Research Design', right_after_h1=True)
    add_p('The work follows the design science paradigm (Hevner et al., 2004), in which knowledge is gained by building and evaluating an artifact that addresses a relevant problem. The process is structured according to the six activities of the design science research methodology of Peffers et al. (2007); Table 2 maps each activity to the part of this paper in which it is reported. The evaluation follows the case-study guidelines of Runeson and Höst (2009), with the platform applied to a demonstration backend as the unit of analysis, and the research questions are refined with the Goal–Question–Metric approach (Basili et al., 1994).', indent=False)

    add_tbl_caption('Table 2: Design science activities and where they are reported.')
    tbl2 = doc.add_table(rows=7, cols=3)
    tbl2.alignment = WD_TABLE_ALIGNMENT.CENTER
    set_table_borders(tbl2)
    tbl2_data = [
        ['Activity', 'Application in this work', 'Section'],
        ['1. Problem', 'Undocumented backends, unsafe analysis, LLM hallucination', '1, 3.2'],
        ['2. Objectives', 'Five objectives O1 to O5', '3.2'],
        ['3. Design', 'Four-stage pipeline, AST engine, grounding', '4, 5'],
        ['4. Demonstration', 'Analysis of an e-commerce and auth API', '6.1'],
        ['5. Evaluation', 'RQ1 to RQ3 with defined metrics', '6.2'],
        ['6. Communication', 'This paper', 'all']
    ]
    for r_idx, row in enumerate(tbl2.rows):
        for c_idx, cell in enumerate(row.cells):
            cell.text = tbl2_data[r_idx][c_idx]
            p = cell.paragraphs[0]
            p.alignment = WD_ALIGN_PARAGRAPH.LEFT
            r = p.runs[0]
            r.font.name = 'Times New Roman'
            r.font.size = Pt(8)
            if r_idx == 0:
                r.font.bold = True
            set_cell_margins(cell, 60, 60, 80, 80)

    add_h2('3.2 Problem Statement and Objectives')
    add_p('Four recurring challenges motivate the work. (i) Knowledge loss and onboarding friction: when authors leave, undocumented routing logic becomes tribal knowledge and newcomers must trace nested router.use() calls, middleware gates and controllers manually. (ii) Contract mismatch and QA overhead: front-end and mobile teams guess request and response shapes, and testers write Postman collections and curl commands by hand. (iii) Hidden architectural dependencies: nothing shows which route reaches which controller, service or database model. (iv) Security exposure: state-changing endpoints (POST, PUT, DELETE) frequently lack authentication middleware (OWASP Foundation, 2023), and dynamic analysis tools run the untrusted application, for example with npm start, which exposes the analysis host.', indent=False)
    add_p('The objectives of the platform are therefore to:', indent=False)
    add_bullet('(O1) build an extensible static AST parser for Node.js and Express that extracts routes, handlers and parameter schemas;')
    add_bullet('(O2) construct an ORM analyzer that extracts database models, fields, keys and relations;')
    add_bullet('(O3) synthesise standards-compliant OpenAPI 3.0 specifications and Postman collections;')
    add_bullet('(O4) develop a static security scanner that flags broken authentication, missing input validation and injection-prone patterns;')
    add_bullet('(O5) deploy a conversational assistant that answers codebase questions with exact file and line citations.')

    add_h2('3.3 Goal, Questions and Metrics')
    add_p('Following the Goal–Question–Metric approach (Basili et al., 1994), the goal is to analyse the platform for the purpose of evaluation with respect to completeness, safety and artifact coverage, from the viewpoint of a developer who inherits an undocumented Express backend. Table 3 lists the research questions with their metrics and the evidence collected.', indent=False)

    add_tbl_caption('Table 3: Research questions, metrics and evidence.')
    tbl3 = doc.add_table(rows=5, cols=3)
    tbl3.alignment = WD_TABLE_ALIGNMENT.CENTER
    set_table_borders(tbl3)
    tbl3_data = [
        ['RQ', 'Metric', 'Evidence collected'],
        ['RQ1', 'Route coverage RC, defined in Equation (2)', 'Engine output compared with ground truth'],
        ['RQ2', 'Host executions HE: processes spawned or packages installed', 'Inspection of pipeline and run observation'],
        ['RQ3', 'Artifact types generated, out of seven in Table 4', 'One analysis run; outputs checked in dashboard'],
        ['RQ4', 'Onboarding time; correct INFERRED share', 'Planned user study (future work)']
    ]
    for r_idx, row in enumerate(tbl3.rows):
        for c_idx, cell in enumerate(row.cells):
            cell.text = tbl3_data[r_idx][c_idx]
            p = cell.paragraphs[0]
            p.alignment = WD_ALIGN_PARAGRAPH.LEFT
            r = p.runs[0]
            r.font.name = 'Times New Roman'
            r.font.size = Pt(8)
            if r_idx == 0:
                r.font.bold = True
            set_cell_margins(cell, 60, 60, 80, 80)

    # --- 4 SYSTEM DESIGN ---
    add_h1('4 SYSTEM DESIGN')
    add_h2('4.1 Architecture Overview', right_after_h1=True)
    add_p('Figure 1 shows the four-stage pipeline. Stage 1 ingests and sanitises the repository, Stage 2 extracts deterministic facts with an AST engine, Stage 3 enriches them with a grounded reasoning layer, and Stage 4 renders all artifacts from the resulting normalised model. The ordering is deliberate: the language model never sees unverified input as truth and never writes into the set of detected facts.', indent=False)

    fig1_text = (
        "+-----------------------------------------+\n"
        "|         Stage 1: Safe Ingestion         |\n"
        "| * ZIP / GitHub; Path sanitisation       |\n"
        "| * No shell execution, no npm install    |\n"
        "+--------------------+--------------------+\n"
        "                     |\n"
        "                     v\n"
        "+-----------------------------------------+\n"
        "|        Stage 2: Static AST Engine       |\n"
        "| * Babel/TS AST: routes, mounts, mw      |\n"
        "| * Controllers: req.*, res.status        |\n"
        "| * ORM models: Prisma, Sequelize, Mongo  |\n"
        "+--------------------+--------------------+\n"
        "                     | DETECTED facts\n"
        "                     v\n"
        "+-----------------------------------------+\n"
        "|      Stage 3: Grounded AI Reasoning     |\n"
        "| * Gemini / Claude / Offline heuristics  |\n"
        "| * File + line citations (INFERRED)      |\n"
        "+--------------------+--------------------+\n"
        "                     | Normalised model\n"
        "                     v\n"
        "+-----------------------------------------+\n"
        "|    Stage 4: Artifact and UI Generation  |\n"
        "| * OpenAPI 3.0.3, Postman v2.1           |\n"
        "| * React Flow graph, Mermaid ERD         |\n"
        "| * Security audit, Jest/Supertest        |\n"
        "+-----------------------------------------+"
    )
    add_code_block(fig1_text)
    add_fig_caption('Figure 1: Four-stage architecture of the platform.')

    add_h2('4.2 Safe Ingestion')
    add_p('The platform accepts a ZIP archive or the URL of a public GitHub repository. Archives are extracted with explicit path sanitisation: the resolved path of every entry must remain inside the workspace directory, which blocks Zip Slip attacks in which entries such as ../../x escape the extraction directory (Snyk, 2018). Public repositories are cloned into the workspace and treated exactly like an extracted archive. No step invokes a package manager, a build tool or a shell on repository content; files are only read as text and parsed. Consequently, install scripts, post-install hooks and start-up code of the uploaded project cannot run on the analysis host.', indent=False)

    add_h2('4.3 Static AST Engine')
    add_p('The engine parses every JavaScript and TypeScript file with the Babel parser (Babel Team, 2024) and traverses the trees with the Babel traversal library. Four analyses run over the resulting syntax trees.', indent=False)

    add_h3('4.3.1 Framework Detection', right_after_h2=True)
    add_p('A detector inspects the package.json dependencies and file-level heuristics, for example imports of express (OpenJS Foundation, 2024a) and calls to Router(), to select an analyzer. At present Express is supported; the analyzer interface is designed so that Fastify, NestJS or non-JavaScript frameworks can be added as plugins.', indent=False)

    add_h3('4.3.2 Route and Mount Resolution')
    add_p('Express applications assemble URLs across files: a router declares relative paths and a parent mounts it under a prefix with app.use. The full path of a route r is therefore the normalised concatenation of all mount prefixes on the way from the application entry module to r, followed by the path of the route itself (Equation (1)).', indent=False)

    p_eq1 = doc.add_paragraph()
    p_eq1.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_eq1.paragraph_format.space_before = Pt(6)
    p_eq1.paragraph_format.space_after = Pt(6)
    r_eq1 = p_eq1.add_run('P(r) = norm(m1 · m2 · … · mk · pr)           (1)')
    r_eq1.font.name = 'Times New Roman'
    r_eq1.font.italic = True
    r_eq1.font.size = Pt(10)

    add_p('Here mi are the mount prefixes, pr is the route path declared in the router, · denotes string concatenation and norm collapses duplicate and trailing slashes. Algorithm 1 performs this resolution recursively. Starting at the entry module with an empty prefix, it records every verb call (get, post, put, patch, delete) together with its middleware list and handler reference and, for every mount call, resolves the imported child router through the import graph and recurses with the extended prefix. A visited set keyed by module and prefix prevents infinite recursion on cyclic imports.', indent=True)

    algo1_text = (
        "Data: module M, prefix π (empty), visited set V\n"
        "Result: route records R\n"
        "if (M, π) ∈ V then return ∅;\n"
        "add (M, π) to V; R ← ∅;\n"
        "foreach call expression c in AST(M) do\n"
        "  if c is router.VERB(path, mw…, h) then\n"
        "    add (VERB, norm(π · path), mw, h) to R;\n"
        "  else if c is app.use(prefix, child) then\n"
        "    M′ ← resolve child via imports;\n"
        "    R ← R ∪ ResolveRoutes(M′, norm(π · prefix), V);\n"
        "  end\n"
        "end\n"
        "return R"
    )
    add_code_block(algo1_text)
    add_tbl_caption('Algorithm 1: Recursive route and mount resolution.')

    listing1_text = (
        "app.use('/api/v1', orders);\n"
        "// orders.js\n"
        "router.post('/orders', requireAuth, create);\n"
        "// => POST /api/v1/orders\n"
        "//    middleware: requireAuth\n"
        "//    handler: create [DETECTED]"
    )
    add_code_block(listing1_text)
    add_tbl_caption('Listing 1: Mounted route and the extracted record.')

    add_h3('4.3.3 Controller Analysis')
    add_p('Handlers are resolved from inline functions or imported controller modules. For each handler the analyzer records destructuring and member access on req.params, req.query and req.body, which yields parameter names and their location, and collects the arguments of res.status and res.sendStatus calls, which yields the status codes that the handler can return. Because these facts come directly from syntax they are classified DETECTED. Types and constraints that cannot be read from syntax are not guessed by the engine; they are left to the reasoning layer, where they are labelled INFERRED.', indent=False)

    add_h3('4.3.4 ORM Model Extraction')
    add_p('The database analyzer reads Prisma schema files, Sequelize model definitions and Mongoose schemas and extracts entities, fields, keys and relations into a common representation. This representation feeds the Mermaid (Mermaid contributors, 2024) ER diagram and gives the dependency graph its edges from endpoints to the data entities they touch.', indent=False)

    add_h2('4.4 Grounded AI Reasoning')
    add_p('The reasoning layer receives the normalised model rather than raw repository text. A provider abstraction supports Gemini, OpenAI and Claude and falls back to an offline heuristic engine that needs no API key. The layer adds business purpose, plain-language descriptions, error explanations and edge cases. Two rules limit hallucination. First, deterministic facts such as paths, verbs, parameters, status codes and middleware are copied from Stage 2 and tagged DETECTED; the model can neither add nor remove them. Second, everything the model contributes is tagged INFERRED and carries a citation to the file and line that supports it. The same discipline governs the chat assistant which, in the spirit of retrieval-augmented generation (Lewis et al., 2020; Gao et al., 2023), answers questions from the model and source excerpts and returns the file and line of each supporting item.', indent=False)

    add_h2('4.5 Artifact Generation')
    add_p('Table 4 lists the artifacts. All generators read the same knowledge model, so they stay mutually consistent, and re-running the analysis after a code change regenerates every artifact, which supports living documentation. The OpenAPI output follows version 3.0.3 of the specification (OpenAPI Initiative, 2021) and the Postman output follows collection format v2.1.0 (Postman, 2021); the dependency graph is rendered with React Flow (xyflow, 2024).', indent=False)

    add_tbl_caption('Table 4: Artifacts generated from the knowledge model.')
    tbl4 = doc.add_table(rows=8, cols=3)
    tbl4.alignment = WD_TABLE_ALIGNMENT.CENTER
    set_table_borders(tbl4)
    tbl4_data = [
        ['Artifact', 'Format', 'Derived from'],
        ['API documentation', 'OpenAPI 3.0.3, Swagger UI', 'Routes, parameters, statuses'],
        ['Postman collection', 'Collection v2.1.0 JSON', 'Routes, parameters'],
        ['Dependency graph', 'React Flow', 'Route, controller, model links'],
        ['Database diagram', 'Mermaid ER', 'ORM models'],
        ['Security audit', 'Findings list', 'Middleware chains, handlers'],
        ['Test suite', 'Jest and Supertest', 'Routes, observed status codes'],
        ['API playground', 'HTTP console (SSRF safe)', 'OpenAPI model']
    ]
    for r_idx, row in enumerate(tbl4.rows):
        for c_idx, cell in enumerate(row.cells):
            cell.text = tbl4_data[r_idx][c_idx]
            p = cell.paragraphs[0]
            p.alignment = WD_ALIGN_PARAGRAPH.LEFT
            r = p.runs[0]
            r.font.name = 'Times New Roman'
            r.font.size = Pt(8)
            if r_idx == 0:
                r.font.bold = True
            set_cell_margins(cell, 60, 60, 80, 80)

    add_h2('4.6 Security Scanner, Tests and Playground')
    add_p('The static security scanner flags broken authentication, that is state-changing routes without authentication middleware in their chain, missing input validation, and injection-prone patterns. These categories correspond to entries of the OWASP API Security Top 10 (OWASP Foundation, 2023). The test generator emits one Jest (OpenJS Foundation, 2024b) and Supertest case per route with the observed status codes as expected outcomes. The playground lets the user send requests to a chosen target from the dashboard; SSRF guardrails prevent the console from being used to reach internal network resources.', indent=False)

    add_h2('4.7 Data Flow')
    add_p('Figure 2 presents the data flow in data flow diagram notation (DeMarco, 1978; Gane and Sarson, 1979): rectangles denote external entities, circles processes and open rectangles data stores. At Level 0 the platform is a single process between the developer, who supplies a ZIP file or a Git URL, and the dashboard that returns the results. Figure 2 decomposes it at Level 1 into ingestion (1.0), framework detection (2.0), AST analysis (3.0, comprising route extraction 3.1, controller analysis 3.2 and database analysis 3.3), AI reasoning (4.0) and artifact generation (5.0). Data store D1 holds the normalised knowledge model and D2 to D5 hold the generated artifacts.', indent=False)

    fig2_text = (
        "      [Developer / User]\n"
        "              |\n"
        "              v\n"
        "      (( 1.0 Ingestion ))\n"
        "              |\n"
        "              v\n"
        "      (( 2.0 Framework ))\n"
        "              |\n"
        "              v\n"
        "      (( 3.0 AST Static Analyzer ))\n"
        "              |\n"
        "              v\n"
        "      (( 4.0 AI Reasoning Engine ))\n"
        "              |\n"
        "              v\n"
        "   == D1: Intermediate Model ==\n"
        "              |\n"
        "              v\n"
        "      (( 5.0 Artifact & UI Gen ))\n"
        "        /     |       |     \\\n"
        "       v      v       v      v\n"
        "     [D2]    [D3]    [D4]   [D5]\n"
        "   OpenAPI Postman Graphs Security"
    )
    add_code_block(fig2_text)
    add_fig_caption('Figure 2: Level-1 data flow diagram of the platform.')

    # --- 5 IMPLEMENTATION ---
    add_h1('5 IMPLEMENTATION')
    add_p('Table 5 summarises the technology stack. The client is a React 18 single-page application built with Vite and TypeScript; the server is written in TypeScript on Node.js 18 or later (tested on Node 24 LTS) with Express. Persistence uses PostgreSQL through a connection pool and falls back automatically to a local JSON store, so that the platform runs on a laptop without set-up. The whole stack consists of free and open-source software and the offline reasoning provider needs no paid key, so the running cost is zero. A machine with an Intel Core i5, AMD Ryzen 5 or Apple Silicon processor, 8 GB of RAM (16 GB for large workspaces) and 2 GB of storage is sufficient.', indent=False)

    add_tbl_caption('Table 5: Technology stack.')
    tbl5 = doc.add_table(rows=6, cols=2)
    tbl5.alignment = WD_TABLE_ALIGNMENT.CENTER
    set_table_borders(tbl5)
    tbl5_data = [
        ['Layer', 'Technologies'],
        ['Client', 'React 18, Vite, TypeScript, Tailwind CSS, React Flow, swagger-ui, mermaid.js'],
        ['Server', 'Node.js, Express, TypeScript, adm-zip, yaml, axios'],
        ['AST engine', 'Babel parser, traverse and types'],
        ['Storage', 'PostgreSQL with JSON-file fallback'],
        ['AI layer', 'Pluggable: Gemini, OpenAI, Claude, offline heuristics']
    ]
    for r_idx, row in enumerate(tbl5.rows):
        for c_idx, cell in enumerate(row.cells):
            cell.text = tbl5_data[r_idx][c_idx]
            p = cell.paragraphs[0]
            p.alignment = WD_ALIGN_PARAGRAPH.LEFT
            r = p.runs[0]
            r.font.name = 'Times New Roman'
            r.font.size = Pt(8)
            if r_idx == 0:
                r.font.bold = True
            set_cell_margins(cell, 60, 60, 80, 80)

    add_p('The system was developed in about 200 engineering hours over eight weeks in six phases: foundation and architecture; ingestion and the AST engine; database analysis and the intermediate model; generators and visualisations; security, tests, playground and AI chat; and evaluation with a demonstration.', indent=True)

    # --- 6 RESULTS AND DISCUSSION ---
    add_h1('6 RESULTS AND DISCUSSION')
    add_p('The platform was applied to a demonstration backend, a multi-layered e-commerce and authentication REST API written for Node.js and Express and distributed with the project (examples/demo-api). The ground truth is the set of routes obtained by manually reading the source, including nested mounts. The analysis consists of a single run on the unmodified source. For RQ1 the route coverage is defined in Equation (2):', indent=False)

    p_eq2 = doc.add_paragraph()
    p_eq2.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_eq2.paragraph_format.space_before = Pt(6)
    p_eq2.paragraph_format.space_after = Pt(6)
    r_eq2 = p_eq2.add_run('RC = |Rdet ∩ Rgt| / |Rgt| × 100%           (2)')
    r_eq2.font.name = 'Times New Roman'
    r_eq2.font.italic = True
    r_eq2.font.size = Pt(10)

    add_p('where Rdet is the set of routes reported by the engine and Rgt the ground truth. For RQ2 the host-execution count HE is the number of processes spawned or packages installed on repository content; the target value is zero. For RQ3 the number of artifact types of Table 4 that the run produced is counted.', indent=True)

    add_tbl_caption('Table 6: Summary of results on the demonstration backend.')
    tbl6 = doc.add_table(rows=5, cols=3)
    tbl6.alignment = WD_TABLE_ALIGNMENT.CENTER
    set_table_borders(tbl6)
    tbl6_data = [
        ['RQ', 'Metric', 'Result'],
        ['RQ1', 'Route coverage RC', '100%'],
        ['RQ2', 'Host executions HE', '0'],
        ['RQ3', 'Artifact types generated', '7 of 7'],
        ['RQ4', 'Onboarding time, INFERRED accuracy', 'Not yet evaluated']
    ]
    for r_idx, row in enumerate(tbl6.rows):
        for c_idx, cell in enumerate(row.cells):
            cell.text = tbl6_data[r_idx][c_idx]
            p = cell.paragraphs[0]
            p.alignment = WD_ALIGN_PARAGRAPH.LEFT
            r = p.runs[0]
            r.font.name = 'Times New Roman'
            r.font.size = Pt(8)
            if r_idx == 0:
                r.font.bold = True
            set_cell_margins(cell, 60, 60, 80, 80)

    add_p('Table 6 summaries the outcome. RQ1: the engine discovered every route of the ground truth, so RC = 100%, including nested routes for which the prefix concatenation of Equation (1) produced the full path. RQ2: the analysis consisted of file reads and AST parsing only, and no repository code was executed; HE = 0. RQ3: the single run produced all seven artifact types of Table 4, which were exposed in the dashboard. Parameters and status codes observed in handlers appear in the specification as DETECTED, whereas explanatory text is labelled INFERRED with citations.', indent=True)
    add_p('The results indicate that a syntax-directed engine is sufficient to recover the route surface of a conventionally structured Express backend without annotations, which is the main difference from annotation-based generators (Lercher et al., 2024), and that zero-execution analysis is achievable in practice. The separation of DETECTED and INFERRED statements lets a reviewer concentrate verification effort on the inferred part, which addresses the concern that analysis output is hard to act upon (Johnson et al., 2013). The expectation that onboarding time falls markedly, with a project target of more than 60%, remains a hypothesis (RQ4) until a user study has been carried out.', indent=True)

    # --- 7 THREATS TO VALIDITY ---
    add_h1('7 THREATS TO VALIDITY')
    add_p('The threats are discussed along the categories of Wohlin et al. (2012). Construct validity: RC measures route discovery only; the correctness of parameters, schemas and descriptions is not covered, and the ground truth was derived manually by the authors, so errors in it would affect RC. Internal validity: the DETECTED part is deterministic, but the INFERRED part depends on the language model and may vary between runs and providers. External validity: a single backend authored within the project and a single framework were used; repositories that register routes dynamically, for instance in loops, from computed paths or through plugins, cannot be fully resolved by static analysis and are untested. Conclusion validity: with one case no statistical inference is possible and the results are descriptive. There is also no baseline comparison with annotation-based generators or LLM-only approaches. A benchmark of open-source Express projects with ground-truth routes and a controlled study with developers are the next steps.', indent=False)

    # --- 8 CONCLUSIONS ---
    add_h1('8 CONCLUSIONS')
    add_p('This paper presented the AI API Reverse-Engineering Platform, developed and evaluated as a design science artifact. It recovers the API surface of a backend repository by static AST analysis, enriches it with a grounded reasoning layer and generates documentation, specifications, graphs, security findings and tests from one knowledge model without executing the analysed code. On the demonstration backend it achieved complete route coverage (RQ1), executed no repository code (RQ2) and produced all seven artifact types in one run (RQ3). The explicit separation of DETECTED facts from INFERRED statements, with file and line citations, is the central mechanism against hallucination.', indent=False)
    add_p('Future work covers plugin analyzers for Fastify, NestJS, Django, FastAPI, Spring Boot and Laravel, webhook-driven re-analysis for continuous documentation, an evaluation on a benchmark of open-source repositories with a quantitative comparison to baselines, and a user study that measures onboarding time (RQ4) and the rate of hallucinated statements.', indent=True)

    # --- ACKNOWLEDGEMENTS ---
    add_h1('ACKNOWLEDGEMENTS')
    add_p('The authors wish to express their profound intellectual debt and heartfelt gratitude to our research supervisor, Dr. Sumit Patil, whose rigorous critique, foundational insights in static program analysis, and unwavering encouragement guided this work from conceptualization to empirical validation.', indent=False)
    add_p('We also extend our sincere appreciation to the Department of Electronics and Computer Engineering at Zeal College of Engineering for providing the high-performance computing resources, dedicated research laboratory environments, and administrative support essential to benchmarking multi-tiered microservice architectures.', indent=True)
    add_p('Furthermore, we acknowledge the open-source compiler community—specifically the maintainers of the Babel AST parser and the OWASP API Security Project—whose foundational frameworks enabled our zero-execution analysis paradigm. Finally, we thank our departmental colleagues and anonymous peer reviewers whose constructive feedback greatly enhanced the technical clarity and scientific rigor of this manuscript.', indent=True)

    # --- REFERENCES ---
    add_h1('REFERENCES')

    references_list = [
        "Aho, A. V., Lam, M. S., Sethi, R., Ullman, J. D. (2006). Compilers: Principles, Techniques, and Tools. Boston, MA, USA: Addison-Wesley, 2nd edition.",
        "Andreasen, E., Gong, L., Møller, A., Pradel, M., Sen, K. (2017). A survey of dynamic analysis and test generation for JavaScript. ACM Comput. Surv., 50(5), 66:1–66:36.",
        "Arcuri, A. (2019). RESTful API automated test case generation with EvoMaster. ACM Trans. Softw. Eng. Methodol., 28(1), 3:1–3:37.",
        "Atlidakis, V., Godefroid, P., Polishchuk, M. (2019). RESTler: Stateful REST API fuzzing. In Proc. IEEE/ACM 41st Int. Conf. Softw. Eng. (ICSE), pp. 748–758.",
        "Babel Team (2024). Babel: The compiler for next generation JavaScript. Available: https://babeljs.io.",
        "Bartłomiejczyk, M., El Fray, I., Kamoun, F. (2025). Enhancing two-factor authentication security by analyzing and detecting SMS OTP-interception techniques in Android malware. IEEE Access, 13, 185926–185942.",
        "Basili, V. R., Caldiera, G., Rombach, H. D. (1994). The goal question metric approach. In Encyclopedia of Software Engineering, vol. 1. New York, NY, USA: Wiley, pp. 528–532.",
        "Boronat, A., Mustafa, J. (2025). MDRE-LLM: A tool for analyzing and applying LLMs in software reverse engineering. In Proc. IEEE Int. Conf. Softw. Anal., Evol. Reengineering (SANER), pp. 850–854.",
        "Brown, T. B., Mann, B., Ryder, N., Subbiah, M., Kaplan, J., Dhariwal, P., Neelakantan, A., Shyam, P., Sastry, G., Askell, A., Agarwal, S., Herbert-Voss, A., Krueger, G., Henighan, T., Child, R., Ramesh, A., Ziegler, D. M., Wu, J., Winter, C., ... Amodei, D. (2020). Language models are few-shot learners. In Proc. Adv. Neural Inf. Process. Syst. (NeurIPS), vol. 33, pp. 1877–1901.",
        "Chen, M., Tworek, J., Jun, H., Yuan, F., Pinto, H. P. d. O., Kaplan, J., Edwards, H., Burda, Y., Joseph, N., Brockman, G., Ray, A., Puri, R., Dennison, G., Bright, F., Cheslack-Postava, E., Motwani, A., Lu, P., Zhang, E., Liu, E., ... Zaremba, W. (2021). Evaluating large language models trained on code. arXiv:2107.03374.",
        "DeMarco, T. (1978). Structured Analysis and System Specification. New York, NY, USA: Yourdon Press.",
        "Di Francesco, P., Lago, P., Malavolta, I. (2018). Migrating towards microservice architectures: An industrial survey. In Proc. IEEE Int. Conf. Softw. Archit. (ICSA), pp. 29–39.",
        "Fan, A., Gokkaya, B., Harman, M., Lyubarskiy, M., Sengupta, S., Yoo, S., Zhang, J. M. (2023). Large language models for software engineering: Survey and open problems. In Proc. IEEE/ACM Int. Conf. Softw. Eng.: Future Softw. Eng. (ICSE-FoSE), pp. 31–53.",
        "Feng, Z., Guo, D., Tang, D., Duan, N., Feng, X., Gong, M., Shou, L., Qin, B., Liu, T., Daxin, J., Zhou, M. (2020). CodeBERT: A pre-trained model for programming and natural languages. In Findings Assoc. Comput. Linguistics: EMNLP, pp. 1536–1547.",
        "Fielding, R. T. (2000). Architectural styles and the design of network-based software architectures. Ph.D. dissertation, Dept. Inf. Comput. Sci., Univ. California, Irvine, CA, USA.",
        "Forward, A., Lethbridge, T. C. (2002). The relevance of software documentation, tools and technologies: A survey. In Proc. ACM Symp. Document Eng. (DocEng), pp. 26–33.",
        "Gane, C., Sarson, T. (1979). Structured Systems Analysis: Tools and Techniques. Englewood Cliffs, NJ, USA: Prentice-Hall.",
        "Gao, Y., Xiong, Y., Gao, X., Jia, K., Pan, J., Bi, Y., Dai, Y., Sun, J., Wang, M., Wang, H. (2023). Retrieval-augmented generation for large language models: A survey. arXiv:2312.10997.",
        "Golmohammadi, A., Zhang, M., Arcuri, A. (2023). Testing RESTful APIs: A survey. ACM Trans. Softw. Eng. Methodol., 33(1), 27:1–27:41.",
        "Hevner, A. R., March, S. T., Park, J., Ram, S. (2004). Design science in information systems research. MIS Quart., 28(1), 75–105.",
        "Hou, X., Zhao, Y., Liu, Y., Yang, Z., Wang, K., Li, L., Ojha, X., Bissyandé, T. F., Lo, D. (2024). Large language models for software engineering: A systematic literature review. ACM Trans. Softw. Eng. Methodol., 33(8), 1–79.",
        "Hu, X., Fu, Z., Xie, S., Ding, S. H. H., Charland, P. (2025). SoK: Potentials and challenges of large language models for reverse engineering. arXiv:2509.21821.",
        "Huang, L., Yu, W., Wang, W., Niu, F., Zheng, C., Ye, Q., Zou, F., Liang, Y., He, H., Wang, J., Zhang, F. (2025). A survey on hallucination in large language models: Principles, taxonomy, challenges, and open questions. ACM Trans. Inf. Syst., 43(2), 1–55.",
        "Javed, H., Ali, F., Shah, B., Kwak, D. (2025). Binary code analysis for cybersecurity: A systematic review of forensic techniques in vulnerability detection and anti-evasion strategies. IEEE Access, 13, 167139–167164.",
        "Jensen, S. H., Møller, A., Thiemann, P. (2009). Type analysis for JavaScript. In Proc. Int. Static Anal. Symp. (SAS), pp. 238–255.",
        "Ji, Z., Lee, N., Frieske, R., Yu, T., Su, D., Yan, X., Ishii, E., Bang, Y. J., Madotto, A., Fung, P. (2023). Survey of hallucination in natural language generation. ACM Comput. Surv., 55(12), 248:1–248:38.",
        "Jimenez, C. E., Yang, J., Wettig, A., Yao, S., Pei, K., Press, O., Narasimhan, K. (2024). SWE-bench: Can language models resolve real-world GitHub issues? In Proc. Int. Conf. Learn. Represent. (ICLR).",
        "Johnson, B., Song, Y., Murphy-Hill, E., Bowdidge, R. (2013). Why don’t software developers use static analysis tools to find bugs? In Proc. 35th Int. Conf. Softw. Eng. (ICSE), pp. 672–681.",
        "Kim, M., Xin, Q., Sinha, S., Orso, A. (2022). Automated test generation for REST APIs: No time to rest yet. In Proc. 31st ACM SIGSOFT Int. Symp. Softw. Testing Anal. (ISSTA), pp. 289–301.",
        "Kurniawan, F., Stiawan, D., Antoni, D., Idris, M. Y., Budiarto, R. (2025). A robust and efficient machine learning framework for enhancing early detection of Android malware. IEEE Access, 13, 127183–127220.",
        "Le, T., Tran, T., Cao, D., Le, V., Nguyen, T. N., Nguyen, V. (2024). KAT: Dependency-aware automated API testing with large language models. In Proc. IEEE Conf. Softw. Testing, Verification Validation (ICST), pp. 82–92.",
        "Lercher, A., Macho, C., Bauer, C., Pinzger, M. (2024). Generating accurate OpenAPI descriptions from Java source code. arXiv:2410.23873.",
        "Lewis, P., Perez, E., Piktus, A., Petroni, F., Karpukhin, V., Goyal, N., Küttler, H., Lewis, M., Yih, W.-t., Rocktäschel, T., Riedel, S., Kiela, D. (2020). Retrieval-augmented generation for knowledge-intensive NLP tasks. In Proc. Adv. Neural Inf. Process. Syst. (NeurIPS), vol. 33, pp. 9459–9474.",
        "Luo, Q., Dong, Y., Fan, C., Chen, J., Wu, Z., Wang, S. (2024). RepoAgent: An LLM-powered open-source framework for repository-level code documentation generation. arXiv:2402.16667.",
        "Maalej, W., Robillard, M. P. (2013). Patterns of knowledge in API reference documentation. IEEE Trans. Softw. Eng., 39(9), 1264–1282.",
        "Madsen, M., Livshits, B., Fanning, M. (2013). Practical static analysis of JavaScript applications in the presence of frameworks and libraries. In Proc. 9th Joint Meeting Found. Softw. Eng. (ESEC/FSE), pp. 499–509.",
        "Mermaid contributors (2024). Mermaid: Diagramming and charting tool. Available: https://mermaid.js.org.",
        "Morić, Z., Dakić, V., Kapulica, A. (2026). An in-depth exploration of malware persistence: Reverse engineering, defense, and simulation. IEEE Access, 14, 37384–37397.",
        "Newman, S. (2021). Building Microservices. Sebastopol, CA, USA: O’Reilly Media, 2nd edition.",
        "Nielson, F., Nielson, H. R., Hankin, C. (1999). Principles of Program Analysis. Berlin, Germany: Springer.",
        "Norby, A., Rimal, B. P., Brizendine, B. (2025). Measurement of anti-debugging techniques on the Windows and Linux operating systems for the Intel x86-64 architecture. IEEE Access, 13, 46568–46583.",
        "OpenAPI Initiative (2021). OpenAPI Specification v3.0.3. Available: https://spec.openapis.org/oas/v3.0.3.",
        "OpenJS Foundation (2024a). Express: Fast, unopinionated, minimalist web framework for Node.js. Available: https://expressjs.com.",
        "OpenJS Foundation (2024b). Jest: Delightful JavaScript testing. Available: https://jestjs.io.",
        "OWASP Foundation (2023). OWASP API security top 10 – 2023. Available: https://owasp.org/API-Security/.",
        "Padhy, S. T., Shanthi, P. B., Bijur, G., Hemalatha, S. (2025). A threat-informed approach to malware evasion using DRM and TLS callbacks. IEEE Access, 13, 155195–155202.",
        "Pearce, H., Ahmad, B., Tan, B., Dolan-Gavitt, B., Karri, R. (2022). Asleep at the keyboard? Assessing the security of GitHub Copilot’s code contributions. In Proc. IEEE Symp. Secur. Privacy (SP), pp. 754–768.",
        "Peffers, K., Tuunanen, T., Rothenberger, M. A., Chatterjee, S. (2007). A design science research methodology for information systems research. J. Manage. Inf. Syst., 24(3), 45–77.",
        "Postman (2021). Collection format v2.1.0. Available: https://schema.postman.com/.",
        "Richardson, L., Amundsen, M., Ruby, S. (2013). RESTful Web APIs. Sebastopol, CA, USA: O’Reilly Media.",
        "Robillard, M. P., Bodden, E., Kawrykow, D., Mezini, M., Ratchford, T. (2013). Automated API property inference techniques. IEEE Trans. Softw. Eng., 39(5), 613–637.",
        "Runeson, P., Höst, M. (2009). Guidelines for conducting and reporting case study research in software engineering. Empirical Softw. Eng., 14(2), 131–164.",
        "Sadowski, C., Aftandilian, E., Eagle, A., Miller-Cushon, L., Jaspan, C. (2018). Lessons from building static analysis tools at Google. Commun. ACM, 61(4), 58–66.",
        "Siala, H. A., Lano, K. (2025). Towards using LLMs in the reverse engineering of software systems to object constraint language. In Proc. IEEE Int. Conf. Softw. Anal., Evol. Reengineering (SANER), pp. 1–6.",
        "Snyk (2018). Zip Slip vulnerability. Available: https://security.snyk.io/research/zip-slip-vulnerability.",
        "Soldani, J., Tamburri, D. A., van den Heuvel, W.-J. (2018). The pains and gains of microservices: A systematic grey literature review. J. Syst. Softw., 146, 215–232.",
        "Steinmacher, I., Silva, M. A. G., Gerosa, M. A., Redmiles, D. F. (2015). A systematic literature review on the barriers faced by newcomers to open source software projects. Inf. Softw. Technol., 59, 67–85.",
        "Suo, D., Xue, L., Yu, L., Tan, R., Huang, W., Sun, G. (2025). ARAP: Demystifying anti runtime analysis code in Android apps. IEEE Trans. Softw. Eng., 51(10), 2787–2803.",
        "Uddin, G., Robillard, M. P. (2015). How API documentation fails. IEEE Softw., 32(4), 68–75.",
        "Vaswani, A., Shazeer, N., Parmar, N., Uszkoreit, J., Gomez, A. N., Kaiser, Ł., Polosukhin, I. (2017). Attention is all you need. In Proc. Adv. Neural Inf. Process. Syst. (NeurIPS), vol. 30, pp. 5998–6008.",
        "Wittern, E., Ying, A. T. T., Zheng, Y., Dolby, J., Laredo, J. A. (2017). Statically checking web API requests in JavaScript. In Proc. IEEE/ACM 39th Int. Conf. Softw. Eng. (ICSE), pp. 244–254.",
        "Wohlin, C., Runeson, P., Höst, M., Ohlsson, M. C., Regnell, B., Wesslén, A. (2012). Experimentation in Software Engineering. Berlin, Germany: Springer.",
        "xyflow (2024). React Flow: A library for building node-based user interfaces. Available: https://reactflow.dev.",
        "Zhi, J., Garousi-Yusifoğlu, V., Sun, B., Garousi, G., Shahnewaz, S., Ruhe, G. (2015). Cost, benefits and quality of software development documentation: A systematic mapping. J. Syst. Softw., 99, 175–198."
    ]

    for ref in references_list:
        p = doc.add_paragraph()
        p.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
        p.paragraph_format.line_spacing = 1.0
        p.paragraph_format.left_indent = Cm(0.5)
        p.paragraph_format.first_line_indent = Cm(-0.5)
        p.paragraph_format.space_before = Pt(0)
        p.paragraph_format.space_after = Pt(4)
        r = p.add_run(ref)
        r.font.name = 'Times New Roman'
        r.font.size = Pt(9)

    doc.save(filename)
    print(f"DOCX successfully created: {filename}")

def build_pdf(filename):
    avail_w = 158 * mm
    avail_h = 222 * mm
    col_w = 75 * mm
    col_gap = 8 * mm
    top_h = 112 * mm
    b_h = avail_h - top_h

    doc = BaseDocTemplate(
        filename,
        pagesize=A4,
        leftMargin=26*mm,
        rightMargin=26*mm,
        topMargin=33*mm,
        bottomMargin=42*mm
    )

    # Page 1 frames
    f_top = Frame(26*mm, 42*mm + b_h, avail_w, top_h, id='F_top', leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0)
    f_b1 = Frame(26*mm, 42*mm, col_w, b_h, id='F_b1', leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0)
    f_b2 = Frame((26+75+8)*mm, 42*mm, col_w, b_h, id='F_b2', leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0)
    tpl_p1 = PageTemplate(id='Page1', frames=[f_top, f_b1, f_b2])

    # Later pages frames
    f_c1 = Frame(26*mm, 42*mm, col_w, avail_h, id='F_c1', leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0)
    f_c2 = Frame((26+75+8)*mm, 42*mm, col_w, avail_h, id='F_c2', leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0)
    tpl_later = PageTemplate(id='LaterPages', frames=[f_c1, f_c2])

    doc.addPageTemplates([tpl_p1, tpl_later])

    # Styles
    st = {}
    st['Title'] = ParagraphStyle('Title', fontName='Times-Bold', fontSize=15, leading=17, alignment=TA_CENTER, spaceAfter=18)
    st['Authors'] = ParagraphStyle('Authors', fontName='Times-Roman', fontSize=11, leading=13, alignment=TA_CENTER, spaceAfter=5)
    st['Affiliation'] = ParagraphStyle('Affiliation', fontName='Times-Italic', fontSize=9, leading=11, alignment=TA_CENTER, spaceAfter=2)
    st['Email'] = ParagraphStyle('Email', fontName='Times-Italic', fontSize=9, leading=11, alignment=TA_CENTER, spaceAfter=14)
    st['Keywords'] = ParagraphStyle('Keywords', fontName='Times-Roman', fontSize=9, leading=11, alignment=TA_JUSTIFY, leftIndent=20*mm, spaceAfter=8)
    st['Abstract'] = ParagraphStyle('Abstract', fontName='Times-Roman', fontSize=9, leading=11, alignment=TA_JUSTIFY, leftIndent=20*mm, spaceAfter=0)

    st['H1'] = ParagraphStyle('H1', fontName='Times-Bold', fontSize=13, leading=15, spaceBefore=14, spaceAfter=6, keepWithNext=True)
    st['H1_first'] = ParagraphStyle('H1_first', fontName='Times-Bold', fontSize=13, leading=15, spaceBefore=0, spaceAfter=6, keepWithNext=True)
    st['H2'] = ParagraphStyle('H2', fontName='Times-Bold', fontSize=12, leading=13, spaceBefore=9, spaceAfter=5, keepWithNext=True)
    st['H3'] = ParagraphStyle('H3', fontName='Times-Bold', fontSize=11, leading=12, spaceBefore=7, spaceAfter=4, keepWithNext=True)
    st['Body'] = ParagraphStyle('Body', fontName='Times-Roman', fontSize=10, leading=11.5, alignment=TA_JUSTIFY, firstLineIndent=5*mm, spaceAfter=3)
    st['Body_no_indent'] = ParagraphStyle('Body_no_indent', fontName='Times-Roman', fontSize=10, leading=11.5, alignment=TA_JUSTIFY, firstLineIndent=0, spaceAfter=3)
    st['Bullet'] = ParagraphStyle('Bullet', fontName='Times-Roman', fontSize=10, leading=11.5, alignment=TA_JUSTIFY, leftIndent=4*mm, firstLineIndent=-3*mm, spaceAfter=2)
    st['TableCaption'] = ParagraphStyle('TableCaption', fontName='Times-Roman', fontSize=9, leading=11, alignment=TA_CENTER, spaceBefore=8, spaceAfter=4, keepWithNext=True)
    st['FigCaption'] = ParagraphStyle('FigCaption', fontName='Times-Roman', fontSize=9, leading=11, alignment=TA_CENTER, spaceBefore=4, spaceAfter=8)
    st['Equation'] = ParagraphStyle('Equation', fontName='Times-Italic', fontSize=10, leading=12, alignment=TA_CENTER, spaceBefore=4, spaceAfter=4)
    st['Code'] = ParagraphStyle('Code', fontName='Courier', fontSize=7.5, leading=8.5, leftIndent=2*mm, spaceBefore=3, spaceAfter=3)
    st['Ref'] = ParagraphStyle('Ref', fontName='Times-Roman', fontSize=8.5, leading=10, alignment=TA_JUSTIFY, leftIndent=5*mm, firstLineIndent=-5*mm, spaceAfter=3)

    story = []

    # Title & Metadata in Top Frame
    title_text = '<b>AI API Reverse-Engineering Platform: Zero-Execution AST Analysis with Grounded LLM Reasoning for Automated API Documentation</b>'
    authors_text = 'Nagesh Pawar<sup>1 a</sup>, Akash More<sup>1 b</sup>, Ritesh Shinde<sup>1 c</sup>, Sangram Karanjawane<sup>1 d</sup> and Sumit Patil<sup>1 e</sup>'
    affil_text = '<sup>1</sup> Department of Electronics and Computer Engineering, Zeal College of Engineering and Research, Pune, India'
    email_text = '{nageshpawar2902, sumit.patil}@zealeducation.com'
    kw_text = '<b>Keywords:</b> API Reverse Engineering, Static Analysis, Abstract Syntax Tree, OpenAPI, Large Language Models, Design Science, DevSecOps.'
    abs_text = '<b>Abstract:</b> Backend repositories are often inherited with little or no API documentation, and recovering the contract of an API by hand is slow and error-prone. This paper follows a design science approach to build and evaluate the AI API Reverse-Engineering Platform, which ingests a ZIP archive or a public GitHub repository and recovers the API surface without executing the untrusted code. A deterministic abstract syntax tree (AST) engine resolves routes, mount prefixes, middleware, parameters, status codes and ORM schemas, and a grounded reasoning layer based on large language models adds business intent while labelling each statement as detected or inferred with a file and line citation. A single normalised model drives OpenAPI 3.0 specifications, Postman collections, dependency graphs, ER diagrams, security audits, Jest and Supertest suites and an SSRF-protected playground. Evaluated through three research questions on an e-commerce and authentication demonstration backend, the engine discovered all routes (RC = 100%), executed no repository code and produced all seven artifact types in one run. The study is limited to one backend and one framework; broader benchmarks and a user study are planned.'

    story.append(Paragraph(title_text, st['Title']))
    story.append(Paragraph(authors_text, st['Authors']))
    story.append(Paragraph(affil_text, st['Affiliation']))
    story.append(Paragraph(email_text, st['Email']))
    story.append(Paragraph(kw_text, st['Keywords']))
    story.append(Paragraph(abs_text, st['Abstract']))

    # Break into two columns
    story.append(FrameBreak())
    story.append(NextPageTemplate('LaterPages'))

    # Helper for tables
    def make_table(data, col_widths, font_size=7):
        cell_data = []
        for r_idx, row in enumerate(data):
            cell_row = []
            for c_idx, text in enumerate(row):
                p_st = ParagraphStyle(
                    f'TC_{r_idx}_{c_idx}',
                    fontName='Times-Bold' if r_idx == 0 else 'Times-Roman',
                    fontSize=font_size,
                    leading=font_size + 1.5,
                    alignment=TA_LEFT
                )
                cell_row.append(Paragraph(text, p_st))
            cell_data.append(cell_row)
        t = RLTable(cell_data, colWidths=col_widths)
        t.setStyle(TableStyle([
            ('LINEABOVE', (0, 0), (-1, 0), 0.8, colors.black),
            ('LINEBELOW', (0, 0), (-1, 0), 0.5, colors.black),
            ('LINEBELOW', (0, -1), (-1, -1), 0.8, colors.black),
            ('TOPPADDING', (0, 0), (-1, -1), 2),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 2),
            ('LEFTPADDING', (0, 0), (-1, -1), 2),
            ('RIGHTPADDING', (0, 0), (-1, -1), 2),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ]))
        return t

    # 1 INTRODUCTION
    story.append(Paragraph('1 INTRODUCTION', st['H1_first']))
    story.append(Paragraph('1.1 Background and Motivation', st['H2']))
    story.append(Paragraph('Web APIs are the integration layer of modern software, and REST (Fielding, 2000) remains the dominant style for exposing them (Richardson et al., 2013). In microservice-oriented systems (Newman, 2021; Soldani et al., 2018; Di Francesco et al., 2018) the number of endpoints grows quickly, and routes are added, renamed and re-mounted continuously, while the documents that should describe them are updated late or never. Empirical studies of API documentation report incomplete, ambiguous and outdated content as recurrent problems (Uddin and Robillard, 2015; Maalej and Robillard, 2013), practitioner surveys find that documentation is valued yet frequently out of date (Forward and Lethbridge, 2002), and the cost and benefit of documentation have been studied systematically (Zhi et al., 2015). Poor documentation is also among the barriers reported for newcomers to open-source projects (Steinmacher et al., 2015).', st['Body_no_indent']))
    story.append(Paragraph('For a developer who inherits an undocumented backend, the source code is the only authoritative statement of the API contract, yet recovering it means reading nested router definitions, middleware chains and controllers spread over many files. The consequences are felt downstream: front-end teams guess request and response shapes, testers write collections by hand, and automated REST test generators, which typically consume an OpenAPI description (Atlidakis et al., 2019; Arcuri, 2019; Kim et al., 2022; Golmohammadi et al., 2023), cannot start without an accurate one.', st['Body']))
    story.append(Paragraph('Existing automation covers only part of the problem. Annotation-based generators need framework-specific metadata that developers must add beforehand (Lercher et al., 2024), and dynamic approaches need a running system and representative inputs (Robillard et al., 2013). Large language models (LLMs) summarise code fluently (Chen et al., 2021; Hou et al., 2024) but hallucinate when they are not anchored to verifiable evidence (Ji et al., 2023; Huang et al., 2025). The safety of the analysis host is a further concern: a repository is untrusted input, and tools that install dependencies or start the application in order to inspect it execute arbitrary code taken from that repository.', st['Body']))

    story.append(Paragraph('1.2 Research Questions and Contributions', st['H2']))
    story.append(Paragraph('This paper treats the problem as a design science task (Hevner et al., 2004; Peffers et al., 2007): an artifact, the AI API Reverse-Engineering Platform, is built and then evaluated against explicit research questions (RQs):', st['Body_no_indent']))
    story.append(Paragraph('&bull; <b>RQ1 (completeness):</b> how completely does a zero-execution AST engine recover the route surface of an Express backend?', st['Bullet']))
    story.append(Paragraph('&bull; <b>RQ2 (safety):</b> can an untrusted repository be analysed without executing its code on the analysis host?', st['Bullet']))
    story.append(Paragraph('&bull; <b>RQ3 (artifact coverage):</b> can the documentation, specification, graph, security and test artifacts be generated from a single knowledge model in one run?', st['Bullet']))
    story.append(Paragraph('The main contributions of this work are:', st['Body_no_indent']))
    story.append(Paragraph('&bull; a zero-execution ingestion and AST pipeline that recovers routes, mount prefixes, middleware chains, parameters, status codes and ORM schemas from Node.js and Express projects written in JavaScript or TypeScript;', st['Bullet']))
    story.append(Paragraph('&bull; a grounding discipline in which compiler facts are labelled DETECTED and language-model statements are labelled INFERRED with file and line citations, which limits the effect of hallucination;', st['Bullet']))
    story.append(Paragraph('&bull; a canonical knowledge model from which OpenAPI, Postman, dependency graphs, ER diagrams, security findings, test suites, an SSRF-protected playground and a citation-backed chat are generated in one dashboard;', st['Bullet']))
    story.append(Paragraph('&bull; a structured evaluation of completeness, safety and artifact coverage on a demonstration backend.', st['Bullet']))
    story.append(Paragraph('The paper is organised as follows. Section 2 reviews related work, Section 3 describes the research methodology, Section 4 presents the system design, Section 5 the implementation, Section 6 the evaluation, Section 7 the threats to validity and Section 8 concludes.', st['Body']))

    # 2 RELATED WORK
    story.append(Paragraph('2 RELATED WORK', st['H1']))
    story.append(Paragraph('2.1 API Documentation and Specification Recovery', st['H2']))
    story.append(Paragraph('Inferring API properties from code is an established topic. Robillard et al. (2013) survey static and dynamic techniques that infer properties such as the call ordering of library APIs and show that program analysis can recover constraints without developer annotations. Their focus is in-process libraries, not network-facing endpoints, whose contract is formed by verbs, path templates assembled across files, middleware and payload shapes. Wittern et al. (2017) analyse JavaScript clients statically to check web API requests against specifications; the work shows the value of static reasoning for web APIs but operates on the consumer side and presupposes an existing specification. On the server side, Lercher et al. (2024) generate OpenAPI descriptions from Java source code and compare their accuracy with annotation-driven tools such as springdoc-openapi. This supports the premise that specifications can be derived from code, but the approach is specific to the Java ecosystem.', st['Body_no_indent']))
    story.append(Paragraph('The need for accurate specifications is reinforced by REST testing research. RESTler (Atlidakis et al., 2019), EvoMaster (Arcuri, 2019) and the tools compared by Kim et al. (2022) work from API descriptions, a recent survey (Golmohammadi et al., 2023) organises the field around them, and KAT (Le et al., 2024) adds LLM-based test generation that exploits dependencies between operations. Maalej and Robillard (2013) provide a taxonomy of knowledge types in API reference documentation against which generated documentation can be assessed.', st['Body']))

    story.append(Paragraph('2.2 Static Analysis of JavaScript', st['H2']))
    story.append(Paragraph('Static analysis of JavaScript is difficult because of the dynamic features of the language. Type analysis for JavaScript was an early response (Jensen et al., 2009), later work shows that frameworks and libraries complicate analysis further (Madsen et al., 2013), and a survey of dynamic analysis and test generation for JavaScript (Andreasen et al., 2017) documents the trade-offs between the two families of techniques. The engine presented here therefore does not aim at whole-program soundness. It exploits the fact that Express route registration follows a small set of syntactic idioms, so that a syntax-directed traversal of the abstract syntax tree (Aho et al., 2006; Babel Team, 2024) suffices for the common cases, and it marks what it cannot resolve statically. The theory of such analyses is covered by Nielson et al. (1999).', st['Body_no_indent']))
    story.append(Paragraph('Practical experience also matters. Johnson et al. (2013) found that developers avoid static analysis tools when warnings are false or hard to act upon, and Sadowski et al. (2018) report that analysis at scale succeeded at Google because findings were actionable and integrated into developer workflows. This motivates the DETECTED and INFERRED labels of the platform, which tell the reader how much each statement can be trusted.', st['Body']))

    story.append(Paragraph('2.3 Static and Dynamic Analysis in Security-Oriented Reverse Engineering', st['H2']))
    story.append(Paragraph('Reverse engineering is widely practised in security, where the choice between static and dynamic analysis is a recurring theme. Javed et al. (2025) review 236 papers on binary code analysis and devote one of their six areas to evasion and anti-analysis strategies and their countermeasures. Evasion is common: in 117,270 Android apps, Suo et al. (2025) found that almost all benign (99.6%) and malicious (97.0%) apps implement at least one category of anti-runtime-analysis technique, which can lead to inaccurate analysis results. Norby et al. (2025) measure the performance overhead of six categories of anti-debugging techniques on Windows and Linux, and Padhy et al. (2025) show how binding execution to a machine through DRM fingerprinting and thread-local-storage callbacks thwarts sandbox, virtual-machine and debugger-based analysis.', st['Body_no_indent']))
    story.append(Paragraph('Static approaches remain effective in this setting. Kurniawan et al. (2025) reach 97% accuracy in detecting Android malware from statically extracted features, and Bartłomiejczyk et al. (2025) report that permission-based static analysis still detects SMS-stealing malware under several obfuscation strategies, with a detection rate of almost 70%. Morić et al. (2026) conclude that hybrid analysis that integrates static, dynamic and simulated testing improves detection reliability, but they carry out the dynamic work in controlled environments, which illustrates the cost of executing untrusted code safely. These studies concern binaries and malware rather than API source code. We use them only as evidence for a design principle, namely that the analysis of untrusted artifacts should not depend on running them, and apply that principle to source-level API recovery.', st['Body']))

    story.append(Paragraph('2.4 LLMs for Software Engineering and Documentation', st['H2']))
    story.append(Paragraph('Transformer-based language models (Vaswani et al., 2017) pre-trained on text and code (Chen et al., 2021; Feng et al., 2020; Brown et al., 2020) are now applied across the software engineering lifecycle (Hou et al., 2024; Fan et al., 2023). For documentation, RepoAgent (Luo et al., 2024) generates repository-level documentation with an LLM. For reverse engineering, Hu et al. (2025) systematise LLM-based work and report that retrieval and grounding improve factual accuracy while hallucination and weak reproducibility remain open issues, and Siala and Lano (2025) and Boronat and Mustafa (2025) explore LLMs in model-driven reverse engineering. Hallucination is documented extensively (Ji et al., 2023; Huang et al., 2025), retrieval-augmented generation (Lewis et al., 2020; Gao et al., 2023) is the main mitigation, LLM-written code has been shown to contain security weaknesses (Pearce et al., 2022), and repository-level benchmarks such as SWE-bench (Jimenez et al., 2024) show that tasks requiring an understanding of whole repositories remain hard for language models.', st['Body_no_indent']))

    story.append(Paragraph('2.5 Summary and Research Gap', st['H2']))
    story.append(Paragraph('Table 1 positions the platform against representative work. Three observations motivate the design. First, each contribution solves one sub-problem, such as specification generation, documentation or testing, whereas developers need the whole set of artifacts in one place. Second, specification generators are tied to one technology stack and, when LLMs are used, the output is rarely separated into verified facts and model conjecture. Third, the safety of the analysis host is seldom treated as a design requirement, although repository analysis necessarily handles untrusted code.', st['Body_no_indent']))

    story.append(Paragraph('Table 1: Positioning of this work against related approaches.', st['TableCaption']))
    t1_data = [
        ['Work', 'Analysis', 'Runs code?', 'Main output'],
        ['Robillard et al. (2013)', 'Survey: static/dynamic', 'Partly', 'Library properties'],
        ['Wittern et al. (2017)', 'Static, JS clients', 'No', 'Request checks'],
        ['Lercher et al. (2024)', 'Static, Java source', 'No', 'OpenAPI desc.'],
        ['Luo et al. (2024)', 'LLM, repository level', 'No', 'Code docs'],
        ['Le et al. (2024)', 'LLM, spec driven', 'Yes (live API)', 'API test cases'],
        ['This work', 'AST + grounded LLM', 'No', 'Specs, graphs, tests']
    ]
    story.append(make_table(t1_data, [22*mm, 20*mm, 15*mm, 18*mm], font_size=6.5))

    # 3 RESEARCH METHODOLOGY
    story.append(Paragraph('3 RESEARCH METHODOLOGY', st['H1']))
    story.append(Paragraph('3.1 Research Design', st['H2']))
    story.append(Paragraph('The work follows the design science paradigm (Hevner et al., 2004), in which knowledge is gained by building and evaluating an artifact that addresses a relevant problem. The process is structured according to the six activities of the design science research methodology of Peffers et al. (2007); Table 2 maps each activity to the part of this paper in which it is reported. The evaluation follows the case-study guidelines of Runeson and Höst (2009), with the platform applied to a demonstration backend as the unit of analysis, and the research questions are refined with the Goal–Question–Metric approach (Basili et al., 1994).', st['Body_no_indent']))

    story.append(Paragraph('Table 2: Design science activities and where they are reported.', st['TableCaption']))
    t2_data = [
        ['Activity', 'Application in this work', 'Section'],
        ['1. Problem', 'Undocumented backends, unsafe analysis', '1, 3.2'],
        ['2. Objectives', 'Five objectives O1 to O5', '3.2'],
        ['3. Design', 'Four-stage pipeline, AST engine', '4, 5'],
        ['4. Demonstration', 'E-commerce and auth API', '6.1'],
        ['5. Evaluation', 'RQ1 to RQ3 with defined metrics', '6.2'],
        ['6. Communication', 'This paper', 'all']
    ]
    story.append(make_table(t2_data, [20*mm, 42*mm, 13*mm], font_size=6.5))

    story.append(Paragraph('3.2 Problem Statement and Objectives', st['H2']))
    story.append(Paragraph('Four recurring challenges motivate the work. (i) Knowledge loss and onboarding friction: when authors leave, undocumented routing logic becomes tribal knowledge and newcomers must trace nested router.use() calls, middleware gates and controllers manually. (ii) Contract mismatch and QA overhead: front-end and mobile teams guess request and response shapes, and testers write Postman collections and curl commands by hand. (iii) Hidden architectural dependencies: nothing shows which route reaches which controller, service or database model. (iv) Security exposure: state-changing endpoints (POST, PUT, DELETE) frequently lack authentication middleware (OWASP Foundation, 2023), and dynamic analysis tools run the untrusted application, for example with npm start, which exposes the analysis host.', st['Body_no_indent']))
    story.append(Paragraph('The objectives of the platform are therefore to:', st['Body_no_indent']))
    story.append(Paragraph('&bull; <b>(O1)</b> build an extensible static AST parser for Node.js and Express that extracts routes, handlers and parameter schemas;', st['Bullet']))
    story.append(Paragraph('&bull; <b>(O2)</b> construct an ORM analyzer that extracts database models, fields, keys and relations;', st['Bullet']))
    story.append(Paragraph('&bull; <b>(O3)</b> synthesise standards-compliant OpenAPI 3.0 specifications and Postman collections;', st['Bullet']))
    story.append(Paragraph('&bull; <b>(O4)</b> develop a static security scanner that flags broken authentication, missing input validation and injection-prone patterns;', st['Bullet']))
    story.append(Paragraph('&bull; <b>(O5)</b> deploy a conversational assistant that answers codebase questions with exact file and line citations.', st['Bullet']))

    story.append(Paragraph('3.3 Goal, Questions and Metrics', st['H2']))
    story.append(Paragraph('Following the Goal–Question–Metric approach (Basili et al., 1994), the goal is to analyse the platform for the purpose of evaluation with respect to completeness, safety and artifact coverage, from the viewpoint of a developer who inherits an undocumented Express backend. Table 3 lists the research questions with their metrics and the evidence collected.', st['Body_no_indent']))

    story.append(Paragraph('Table 3: Research questions, metrics and evidence.', st['TableCaption']))
    t3_data = [
        ['RQ', 'Metric', 'Evidence collected'],
        ['RQ1', 'Route coverage RC, Eq. (2)', 'Engine output vs ground truth'],
        ['RQ2', 'Host executions HE', 'Pipeline inspection & run check'],
        ['RQ3', 'Artifact types (Table 4)', 'One analysis run; dashboard check'],
        ['RQ4', 'Onboarding time', 'Planned user study (future work)']
    ]
    story.append(make_table(t3_data, [10*mm, 28*mm, 37*mm], font_size=6.5))

    # 4 SYSTEM DESIGN
    story.append(Paragraph('4 SYSTEM DESIGN', st['H1']))
    story.append(Paragraph('4.1 Architecture Overview', st['H2']))
    story.append(Paragraph('Figure 1 shows the four-stage pipeline. Stage 1 ingests and sanitises the repository, Stage 2 extracts deterministic facts with an AST engine, Stage 3 enriches them with a grounded reasoning layer, and Stage 4 renders all artifacts from the resulting normalised model. The ordering is deliberate: the language model never sees unverified input as truth and never writes into the set of detected facts.', st['Body_no_indent']))

    story.append(Paragraph(fig1_text.replace('\n', '<br/>').replace(' ', '&nbsp;'), st['Code']))
    story.append(Paragraph('Figure 1: Four-stage architecture of the platform.', st['FigCaption']))

    story.append(Paragraph('4.2 Safe Ingestion', st['H2']))
    story.append(Paragraph('The platform accepts a ZIP archive or the URL of a public GitHub repository. Archives are extracted with explicit path sanitisation: the resolved path of every entry must remain inside the workspace directory, which blocks Zip Slip attacks in which entries such as ../../x escape the extraction directory (Snyk, 2018). Public repositories are cloned into the workspace and treated exactly like an extracted archive. No step invokes a package manager, a build tool or a shell on repository content; files are only read as text and parsed. Consequently, install scripts, post-install hooks and start-up code of the uploaded project cannot run on the analysis host.', st['Body_no_indent']))

    story.append(Paragraph('4.3 Static AST Engine', st['H2']))
    story.append(Paragraph('The engine parses every JavaScript and TypeScript file with the Babel parser (Babel Team, 2024) and traverses the trees with the Babel traversal library. Four analyses run over the resulting syntax trees.', st['Body_no_indent']))

    story.append(Paragraph('4.3.1 Framework Detection', st['H3']))
    story.append(Paragraph('A detector inspects the package.json dependencies and file-level heuristics, for example imports of express (OpenJS Foundation, 2024a) and calls to Router(), to select an analyzer. At present Express is supported; the analyzer interface is designed so that Fastify, NestJS or non-JavaScript frameworks can be added as plugins.', st['Body_no_indent']))

    story.append(Paragraph('4.3.2 Route and Mount Resolution', st['H3']))
    story.append(Paragraph('Express applications assemble URLs across files: a router declares relative paths and a parent mounts it under a prefix with app.use. The full path of a route r is therefore the normalised concatenation of all mount prefixes on the way from the application entry module to r, followed by the path of the route itself (Equation (1)).', st['Body_no_indent']))

    story.append(Paragraph('<i>P(r) = norm(m<sub>1</sub> &middot; m<sub>2</sub> &middot; &hellip; &middot; m<sub>k</sub> &middot; p<sub>r</sub>)</i> &nbsp;&nbsp;&nbsp;&nbsp; (1)', st['Equation']))

    story.append(Paragraph('Here mi are the mount prefixes, pr is the route path declared in the router, &middot; denotes string concatenation and norm collapses duplicate and trailing slashes. Algorithm 1 performs this resolution recursively. Starting at the entry module with an empty prefix, it records every verb call (get, post, put, patch, delete) together with its middleware list and handler reference and, for every mount call, resolves the imported child router through the import graph and recurses with the extended prefix. A visited set keyed by module and prefix prevents infinite recursion on cyclic imports.', st['Body']))

    story.append(Paragraph(algo1_text.replace('\n', '<br/>').replace(' ', '&nbsp;'), st['Code']))
    story.append(Paragraph('Algorithm 1: Recursive route and mount resolution.', st['TableCaption']))

    story.append(Paragraph(listing1_text.replace('\n', '<br/>').replace(' ', '&nbsp;'), st['Code']))
    story.append(Paragraph('Listing 1: Mounted route and the extracted record.', st['TableCaption']))

    story.append(Paragraph('4.3.3 Controller Analysis', st['H3']))
    story.append(Paragraph('Handlers are resolved from inline functions or imported controller modules. For each handler the analyzer records destructuring and member access on req.params, req.query and req.body, which yields parameter names and their location, and collects the arguments of res.status and res.sendStatus calls, which yields the status codes that the handler can return. Because these facts come directly from syntax they are classified DETECTED. Types and constraints that cannot be read from syntax are not guessed by the engine; they are left to the reasoning layer, where they are labelled INFERRED.', st['Body_no_indent']))

    story.append(Paragraph('4.3.4 ORM Model Extraction', st['H3']))
    story.append(Paragraph('The database analyzer reads Prisma schema files, Sequelize model definitions and Mongoose schemas and extracts entities, fields, keys and relations into a common representation. This representation feeds the Mermaid (Mermaid contributors, 2024) ER diagram and gives the dependency graph its edges from endpoints to the data entities they touch.', st['Body_no_indent']))

    story.append(Paragraph('4.4 Grounded AI Reasoning', st['H2']))
    story.append(Paragraph('The reasoning layer receives the normalised model rather than raw repository text. A provider abstraction supports Gemini, OpenAI and Claude and falls back to an offline heuristic engine that needs no API key. The layer adds business purpose, plain-language descriptions, error explanations and edge cases. Two rules limit hallucination. First, deterministic facts such as paths, verbs, parameters, status codes and middleware are copied from Stage 2 and tagged DETECTED; the model can neither add nor remove them. Second, everything the model contributes is tagged INFERRED and carries a citation to the file and line that supports it. The same discipline governs the chat assistant which, in the spirit of retrieval-augmented generation (Lewis et al., 2020; Gao et al., 2023), answers questions from the model and source excerpts and returns the file and line of each supporting item.', st['Body_no_indent']))

    story.append(Paragraph('4.5 Artifact Generation', st['H2']))
    story.append(Paragraph('Table 4 lists the artifacts. All generators read the same knowledge model, so they stay mutually consistent, and re-running the analysis after a code change regenerates every artifact, which supports living documentation. The OpenAPI output follows version 3.0.3 of the specification (OpenAPI Initiative, 2021) and the Postman output follows collection format v2.1.0 (Postman, 2021); the dependency graph is rendered with React Flow (xyflow, 2024).', st['Body_no_indent']))

    story.append(Paragraph('Table 4: Artifacts generated from the knowledge model.', st['TableCaption']))
    t4_data = [
        ['Artifact', 'Format', 'Derived from'],
        ['API documentation', 'OpenAPI 3.0.3, Swagger UI', 'Routes, params, statuses'],
        ['Postman collection', 'Collection v2.1.0 JSON', 'Routes, parameters'],
        ['Dependency graph', 'React Flow', 'Route, controller, models'],
        ['Database diagram', 'Mermaid ER', 'ORM models'],
        ['Security audit', 'Findings list', 'Middleware, handlers'],
        ['Test suite', 'Jest and Supertest', 'Routes, status codes'],
        ['API playground', 'HTTP console (SSRF safe)', 'OpenAPI model']
    ]
    story.append(make_table(t4_data, [24*mm, 27*mm, 24*mm], font_size=6.5))

    story.append(Paragraph('4.6 Security Scanner, Tests and Playground', st['H2']))
    story.append(Paragraph('The static security scanner flags broken authentication, that is state-changing routes without authentication middleware in their chain, missing input validation, and injection-prone patterns. These categories correspond to entries of the OWASP API Security Top 10 (OWASP Foundation, 2023). The test generator emits one Jest (OpenJS Foundation, 2024b) and Supertest case per route with the observed status codes as expected outcomes. The playground lets the user send requests to a chosen target from the dashboard; SSRF guardrails prevent the console from being used to reach internal network resources.', st['Body_no_indent']))

    story.append(Paragraph('4.7 Data Flow', st['H2']))
    story.append(Paragraph('Figure 2 presents the data flow in data flow diagram notation (DeMarco, 1978; Gane and Sarson, 1979): rectangles denote external entities, circles processes and open rectangles data stores. At Level 0 the platform is a single process between the developer, who supplies a ZIP file or a Git URL, and the dashboard that returns the results. Figure 2 decomposes it at Level 1 into ingestion (1.0), framework detection (2.0), AST analysis (3.0, comprising route extraction 3.1, controller analysis 3.2 and database analysis 3.3), AI reasoning (4.0) and artifact generation (5.0). Data store D1 holds the normalised knowledge model and D2 to D5 hold the generated artifacts.', st['Body_no_indent']))

    story.append(Paragraph(fig2_text.replace('\n', '<br/>').replace(' ', '&nbsp;'), st['Code']))
    story.append(Paragraph('Figure 2: Level-1 data flow diagram of the platform.', st['FigCaption']))

    # 5 IMPLEMENTATION
    story.append(Paragraph('5 IMPLEMENTATION', st['H1']))
    story.append(Paragraph('Table 5 summarises the technology stack. The client is a React 18 single-page application built with Vite and TypeScript; the server is written in TypeScript on Node.js 18 or later (tested on Node 24 LTS) with Express. Persistence uses PostgreSQL through a connection pool and falls back automatically to a local JSON store, so that the platform runs on a laptop without set-up. The whole stack consists of free and open-source software and the offline reasoning provider needs no paid key, so the running cost is zero. A machine with an Intel Core i5, AMD Ryzen 5 or Apple Silicon processor, 8 GB of RAM (16 GB for large workspaces) and 2 GB of storage is sufficient.', st['Body_no_indent']))

    story.append(Paragraph('Table 5: Technology stack.', st['TableCaption']))
    t5_data = [
        ['Layer', 'Technologies'],
        ['Client', 'React 18, Vite, TypeScript, Tailwind, React Flow, Swagger UI'],
        ['Server', 'Node.js, Express, TypeScript, adm-zip, yaml, axios'],
        ['AST engine', 'Babel parser, traverse and types'],
        ['Storage', 'PostgreSQL with JSON-file fallback'],
        ['AI layer', 'Gemini, OpenAI, Claude, offline heuristics']
    ]
    story.append(make_table(t5_data, [20*mm, 55*mm], font_size=6.5))

    story.append(Paragraph('The system was developed in about 200 engineering hours over eight weeks in six phases: foundation and architecture; ingestion and the AST engine; database analysis and the intermediate model; generators and visualisations; security, tests, playground and AI chat; and evaluation with a demonstration.', st['Body']))

    # 6 RESULTS AND DISCUSSION
    story.append(Paragraph('6 RESULTS AND DISCUSSION', st['H1']))
    story.append(Paragraph('The platform was applied to a demonstration backend, a multi-layered e-commerce and authentication REST API written for Node.js and Express and distributed with the project (examples/demo-api). The ground truth is the set of routes obtained by manually reading the source, including nested mounts. The analysis consists of a single run on the unmodified source. For RQ1 the route coverage is defined in Equation (2):', st['Body_no_indent']))

    story.append(Paragraph('<i>RC = |R<sub>det</sub> &cap; R<sub>gt</sub>| / |R<sub>gt</sub>| &times; 100%</i> &nbsp;&nbsp;&nbsp;&nbsp; (2)', st['Equation']))

    story.append(Paragraph('where Rdet is the set of routes reported by the engine and Rgt the ground truth. For RQ2 the host-execution count HE is the number of processes spawned or packages installed on repository content; the target value is zero. For RQ3 the number of artifact types of Table 4 that the run produced is counted.', st['Body']))

    story.append(Paragraph('Table 6: Summary of results on the demonstration backend.', st['TableCaption']))
    t6_data = [
        ['RQ', 'Metric', 'Result'],
        ['RQ1', 'Route coverage RC', '100%'],
        ['RQ2', 'Host executions HE', '0'],
        ['RQ3', 'Artifact types generated', '7 of 7'],
        ['RQ4', 'Onboarding time', 'Not yet evaluated']
    ]
    story.append(make_table(t6_data, [10*mm, 35*mm, 30*mm], font_size=6.5))

    story.append(Paragraph('Table 6 summaries the outcome. RQ1: the engine discovered every route of the ground truth, so RC = 100%, including nested routes for which the prefix concatenation of Equation (1) produced the full path. RQ2: the analysis consisted of file reads and AST parsing only, and no repository code was executed; HE = 0. RQ3: the single run produced all seven artifact types of Table 4, which were exposed in the dashboard. Parameters and status codes observed in handlers appear in the specification as DETECTED, whereas explanatory text is labelled INFERRED with citations.', st['Body']))
    story.append(Paragraph('The results indicate that a syntax-directed engine is sufficient to recover the route surface of a conventionally structured Express backend without annotations, which is the main difference from annotation-based generators (Lercher et al., 2024), and that zero-execution analysis is achievable in practice. The separation of DETECTED and INFERRED statements lets a reviewer concentrate verification effort on the inferred part, which addresses the concern that analysis output is hard to act upon (Johnson et al., 2013). The expectation that onboarding time falls markedly, with a project target of more than 60%, remains a hypothesis (RQ4) until a user study has been carried out.', st['Body']))

    # 7 THREATS TO VALIDITY
    story.append(Paragraph('7 THREATS TO VALIDITY', st['H1']))
    story.append(Paragraph('The threats are discussed along the categories of Wohlin et al. (2012). Construct validity: RC measures route discovery only; the correctness of parameters, schemas and descriptions is not covered, and the ground truth was derived manually by the authors, so errors in it would affect RC. Internal validity: the DETECTED part is deterministic, but the INFERRED part depends on the language model and may vary between runs and providers. External validity: a single backend authored within the project and a single framework were used; repositories that register routes dynamically, for instance in loops, from computed paths or through plugins, cannot be fully resolved by static analysis and are untested. Conclusion validity: with one case no statistical inference is possible and the results are descriptive. There is also no baseline comparison with annotation-based generators or LLM-only approaches. A benchmark of open-source Express projects with ground-truth routes and a controlled study with developers are the next steps.', st['Body_no_indent']))

    # 8 CONCLUSIONS
    story.append(Paragraph('8 CONCLUSIONS', st['H1']))
    story.append(Paragraph('This paper presented the AI API Reverse-Engineering Platform, developed and evaluated as a design science artifact. It recovers the API surface of a backend repository by static AST analysis, enriches it with a grounded reasoning layer and generates documentation, specifications, graphs, security findings and tests from one knowledge model without executing the analysed code. On the demonstration backend it achieved complete route coverage (RQ1), executed no repository code (RQ2) and produced all seven artifact types in one run (RQ3). The explicit separation of DETECTED facts from INFERRED statements, with file and line citations, is the central mechanism against hallucination.', st['Body_no_indent']))
    story.append(Paragraph('Future work covers plugin analyzers for Fastify, NestJS, Django, FastAPI, Spring Boot and Laravel, webhook-driven re-analysis for continuous documentation, an evaluation on a benchmark of open-source repositories with a quantitative comparison to baselines, and a user study that measures onboarding time (RQ4) and the rate of hallucinated statements.', st['Body']))

    # ACKNOWLEDGEMENTS
    story.append(Paragraph('ACKNOWLEDGEMENTS', st['H1']))
    story.append(Paragraph('The authors wish to express their profound intellectual debt and heartfelt gratitude to our research supervisor, Dr. Sumit Patil, whose rigorous critique, foundational insights in static program analysis, and unwavering encouragement guided this work from conceptualization to empirical validation.', st['Body_no_indent']))
    story.append(Paragraph('We also extend our sincere appreciation to the Department of Electronics and Computer Engineering at Zeal College of Engineering for providing the high-performance computing resources, dedicated research laboratory environments, and administrative support essential to benchmarking multi-tiered microservice architectures.', st['Body']))
    story.append(Paragraph('Furthermore, we acknowledge the open-source compiler community—specifically the maintainers of the Babel AST parser and the OWASP API Security Project—whose foundational frameworks enabled our zero-execution analysis paradigm. Finally, we thank our departmental colleagues and anonymous peer reviewers whose constructive feedback greatly enhanced the technical clarity and scientific rigor of this manuscript.', st['Body']))

    # REFERENCES
    story.append(Paragraph('REFERENCES', st['H1']))

    for ref in references_list:
        story.append(Paragraph(ref, st['Ref']))

    doc.build(story)
    print(f"PDF successfully created: {filename}")

if __name__ == '__main__':
    docx_path = '/Users/nagesh/Downloads/Reverse API Engineering/AI_API_Reverse_Engineering_Platform_SCITEPRESS.docx'
    pdf_path = '/Users/nagesh/Downloads/Reverse API Engineering/AI_API_Reverse_Engineering_Platform_SCITEPRESS.pdf'
    build_docx(docx_path)
    build_pdf(pdf_path)
