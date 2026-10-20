module.exports=[[38067,a=>{var b=a.i(7997),c=a.i(93321),d=a.i(95936);a.i(70396);var e=a.i(73727),f=a.i(717),g=a.i(94758),h=a.i(37137),i=a.i(43975),j=a.i(77064);function k(a){return a>=90?{letter:"A",gpa:4,remark:"Outstanding"}:a>=80?{letter:"B",gpa:3,remark:"Very Good"}:a>=70?{letter:"C",gpa:2,remark:"Good"}:a>=60?{letter:"D",gpa:1,remark:"Satisfactory"}:{letter:"F",gpa:0,remark:"Needs Improvement"}}async function l({studentId:a}){let f=await (0,i.v)();f||(0,e.redirect)("/login");let[m]=await g.f.select({id:h.students.id,schoolId:h.students.schoolId,schoolName:h.schools.name,schoolStatus:h.schools.status,studentNumber:h.students.studentNumber,firstName:h.students.firstName,lastName:h.students.lastName,email:h.students.email,dateOfBirth:h.students.dateOfBirth,status:h.students.status,userId:h.students.userId}).from(h.students).innerJoin(h.schools,(0,c.u)(h.students.schoolId,h.schools.id)).where((0,c.u)(h.students.id,a)).limit(1);m&&"suspended"!==m.schoolStatus||(0,e.notFound)();let n=(0,i.i)(f),o=m.userId===f.user.id;if(!n&&!o){let[a]=await g.f.select({role:h.schoolMemberships.role}).from(h.schoolMemberships).where((0,c.b)((0,c.u)(h.schoolMemberships.schoolId,m.schoolId),(0,c.u)(h.schoolMemberships.userId,f.user.id))).limit(1);a&&["school_admin","teacher"].includes(a.role)||(0,e.notFound)()}let[p]=await g.f.select({id:h.academicYears.id,name:h.academicYears.name,startsOn:h.academicYears.startsOn,endsOn:h.academicYears.endsOn}).from(h.academicYears).where((0,c.b)((0,c.u)(h.academicYears.schoolId,m.schoolId),(0,c.u)(h.academicYears.isCurrent,!0))).limit(1),[q]=p?await g.f.select({id:h.enrollments.id,classroomId:h.classrooms.id,classroomName:h.classrooms.name,gradeName:h.gradeLevels.name,status:h.enrollments.status}).from(h.enrollments).innerJoin(h.classrooms,(0,c.u)(h.enrollments.classroomId,h.classrooms.id)).innerJoin(h.gradeLevels,(0,c.u)(h.classrooms.gradeLevelId,h.gradeLevels.id)).where((0,c.b)((0,c.u)(h.enrollments.studentId,m.id),(0,c.u)(h.enrollments.academicYearId,p.id),(0,c.u)(h.enrollments.status,"enrolled"))).limit(1):[],r=await g.f.select({status:h.attendanceRecords.status,date:h.attendanceRecords.date}).from(h.attendanceRecords).where((0,c.b)((0,c.u)(h.attendanceRecords.studentId,m.id),(0,c.u)(h.attendanceRecords.schoolId,m.schoolId))),s={present:0,late:0,absent:0,excused:0,total:0};for(let a of r)s[a.status]+=1,s.total+=1;let t=s.total>0?Math.round((s.present+s.late)/s.total*100):null,u=q?await g.f.select({id:h.assessments.id,title:h.assessments.title,maxScore:h.assessments.maxScore,subjectId:h.assessments.subjectId,subjectName:h.subjects.name,subjectCode:h.subjects.code}).from(h.assessments).innerJoin(h.subjects,(0,c.u)(h.assessments.subjectId,h.subjects.id)).where((0,c.b)((0,c.u)(h.assessments.schoolId,m.schoolId),(0,c.u)(h.assessments.classroomId,q.classroomId),(0,c.u)(h.assessments.academicYearId,p.id),(0,c.y)(h.assessments.status,["published","closed"]))).orderBy(h.subjects.name,h.assessments.title):[],v=u.map(a=>a.id),[w,x]=await Promise.all([v.length?g.f.select({assessmentId:h.assessmentResults.assessmentId,score:h.assessmentResults.score,feedback:h.assessmentResults.feedback}).from(h.assessmentResults).where((0,c.b)((0,c.u)(h.assessmentResults.schoolId,m.schoolId),(0,c.u)(h.assessmentResults.studentId,m.id),(0,c.y)(h.assessmentResults.assessmentId,v))):Promise.resolve([]),v.length?g.f.select({assessmentId:h.assessmentAttempts.assessmentId,score:h.assessmentAttempts.score,maxScore:h.assessmentAttempts.maxScore}).from(h.assessmentAttempts).where((0,c.b)((0,c.u)(h.assessmentAttempts.schoolId,m.schoolId),(0,c.u)(h.assessmentAttempts.studentId,m.id),(0,c.y)(h.assessmentAttempts.assessmentId,v))):Promise.resolve([])]),y=new Map(w.map(a=>[a.assessmentId,a])),z=new Map(x.map(a=>[a.assessmentId,a])),A=new Map;for(let a of u){let b=y.get(a.id),c=z.get(a.id),d=b?.score??c?.score??null,e=c?.maxScore??a.maxScore,f=b?.feedback??null,g=A.get(a.subjectName);g||(g={subjectName:a.subjectName,subjectCode:a.subjectCode,items:[],totalScore:0,totalMax:0},A.set(a.subjectName,g)),g.items.push({title:a.title,score:d,maxScore:e,feedback:f}),null!==d&&(g.totalScore+=d,g.totalMax+=e)}let B=Array.from(A.values()),C=0,D=0;for(let a of B)C+=a.totalScore,D+=a.totalMax;let E=D>0?Math.round(C/D*100):null,F=null!==E?k(E):null,G=new Intl.DateTimeFormat("en-US",{dateStyle:"long"}).format(new Date);return(0,b.jsxs)("main",{className:"management-page report-card-page",children:[(0,b.jsx)("style",{children:`
        @media print {
          body {
            background: white !important;
            color: black !important;
          }
          .print-hide, .management-back, .management-header, .topbar, .sidebar {
            display: none !important;
          }
          .report-card-container {
            border: 2px solid #0f172a !important;
            box-shadow: none !important;
            margin: 0 !important;
            padding: 24px !important;
            max-width: 100% !important;
          }
          .report-card-header {
            border-bottom: 2px solid #0f172a !important;
          }
          .report-card-table th {
            background-color: #f1f5f9 !important;
            color: black !important;
          }
        }
        .report-card-container {
          background: #ffffff;
          border-radius: 12px;
          border: 1px solid #e2e8f0;
          box-shadow: 0 4px 16px rgba(0,0,0,0.06);
          padding: 32px;
          max-width: 900px;
          margin: 0 auto;
          color: #0f172a;
        }
        .report-card-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          border-bottom: 2px solid #e2e8f0;
          padding-bottom: 20px;
          margin-bottom: 24px;
        }
        .school-emblem {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .emblem-icon {
          width: 44px;
          height: 44px;
          background: #2563eb;
          color: white;
          font-weight: 800;
          font-size: 20px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .school-title {
          font-size: 1.5rem;
          font-weight: 700;
          margin: 0;
          color: #0f172a;
        }
        .report-badge {
          font-size: 0.85rem;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          color: #64748b;
          margin: 0;
        }
        .student-meta-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 16px;
          background: #f8fafc;
          border-radius: 8px;
          padding: 16px 20px;
          margin-bottom: 28px;
          font-size: 0.92rem;
        }
        .meta-item strong {
          display: block;
          font-size: 0.75rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: #64748b;
          margin-bottom: 2px;
        }
        .report-section-title {
          font-size: 1.15rem;
          font-weight: 700;
          margin: 24px 0 12px;
          color: #1e293b;
          border-left: 4px solid #2563eb;
          padding-left: 10px;
        }
        .report-card-table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 20px;
          font-size: 0.9rem;
        }
        .report-card-table th {
          background: #f1f5f9;
          text-align: left;
          padding: 10px 14px;
          font-weight: 600;
          color: #334155;
          border-bottom: 2px solid #cbd5e1;
        }
        .report-card-table td {
          padding: 10px 14px;
          border-bottom: 1px solid #e2e8f0;
          vertical-align: middle;
        }
        .grade-pill {
          display: inline-block;
          padding: 2px 8px;
          border-radius: 4px;
          font-weight: 700;
          font-size: 0.85rem;
        }
        .grade-A { background: #dcfce7; color: #166534; }
        .grade-B { background: #dbeafe; color: #1e40af; }
        .grade-C { background: #fef9c3; color: #854d0e; }
        .grade-D { background: #ffedd5; color: #9a3412; }
        .grade-F { background: #fee2e2; color: #991b1b; }
        .summary-banner {
          display: flex;
          justify-content: space-around;
          align-items: center;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 20px;
          margin: 28px 0;
          text-align: center;
        }
        .summary-metric strong {
          display: block;
          font-size: 1.75rem;
          font-weight: 800;
          color: #0f172a;
        }
        .summary-metric span {
          font-size: 0.8rem;
          text-transform: uppercase;
          color: #64748b;
          letter-spacing: 0.05em;
        }
        .signatures-area {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 24px;
          margin-top: 48px;
          padding-top: 24px;
          border-top: 1px dashed #cbd5e1;
          font-size: 0.85rem;
          color: #475569;
        }
        .signature-line {
          border-bottom: 1px solid #94a3b8;
          height: 36px;
          margin-bottom: 8px;
        }
      `}),(0,b.jsxs)("header",{className:"management-header print-hide",children:[(0,b.jsxs)("div",{children:[(0,b.jsx)(d.default,{href:o?"/my-learning":`/students/${m.id}`,className:"management-back",children:"← Back to Student Record"}),(0,b.jsx)("p",{className:"auth-eyebrow",children:"ACADEMIC EVALUATION"}),(0,b.jsx)("h1",{children:"Official Student Report Card"}),(0,b.jsxs)("p",{className:"management-description",children:["Academic performance summary for ",m.firstName," ",m.lastName,"."]})]}),(0,b.jsx)("div",{style:{display:"flex",gap:"10px",alignItems:"center"},children:(0,b.jsx)(j.PrintButton,{})})]}),(0,b.jsxs)("div",{className:"report-card-container",children:[(0,b.jsxs)("div",{className:"report-card-header",children:[(0,b.jsxs)("div",{className:"school-emblem",children:[(0,b.jsx)("div",{className:"emblem-icon",children:m.schoolName.charAt(0)}),(0,b.jsxs)("div",{children:[(0,b.jsx)("p",{className:"report-badge",children:"Official Academic Report"}),(0,b.jsx)("h2",{className:"school-title",children:m.schoolName})]})]}),(0,b.jsxs)("div",{style:{textAlign:"right"},children:[(0,b.jsx)("p",{style:{margin:0,fontWeight:700,fontSize:"0.95rem"},children:p?p.name:"Academic Year"}),(0,b.jsxs)("p",{style:{margin:0,fontSize:"0.85rem",color:"#64748b"},children:["Issued: ",G]})]})]}),(0,b.jsxs)("div",{className:"student-meta-grid",children:[(0,b.jsxs)("div",{className:"meta-item",children:[(0,b.jsx)("strong",{children:"Student Name"}),(0,b.jsxs)("span",{children:[m.firstName," ",m.lastName]})]}),(0,b.jsxs)("div",{className:"meta-item",children:[(0,b.jsx)("strong",{children:"Student ID"}),(0,b.jsx)("span",{children:m.studentNumber})]}),(0,b.jsxs)("div",{className:"meta-item",children:[(0,b.jsx)("strong",{children:"Grade / Classroom"}),(0,b.jsx)("span",{children:q?`${q.gradeName} - ${q.classroomName}`:"Not Enrolled"})]}),(0,b.jsxs)("div",{className:"meta-item",children:[(0,b.jsx)("strong",{children:"Student Status"}),(0,b.jsx)("span",{style:{textTransform:"capitalize"},children:m.status})]}),m.dateOfBirth&&(0,b.jsxs)("div",{className:"meta-item",children:[(0,b.jsx)("strong",{children:"Date of Birth"}),(0,b.jsx)("span",{children:m.dateOfBirth})]}),m.email&&(0,b.jsxs)("div",{className:"meta-item",children:[(0,b.jsx)("strong",{children:"Contact Email"}),(0,b.jsx)("span",{children:m.email})]})]}),(0,b.jsxs)("div",{className:"summary-banner",children:[(0,b.jsxs)("div",{className:"summary-metric",children:[(0,b.jsx)("strong",{children:null!==E?`${E}%`:"—"}),(0,b.jsx)("span",{children:"Academic Average"})]}),(0,b.jsxs)("div",{className:"summary-metric",children:[(0,b.jsx)("strong",{style:{color:"#2563eb"},children:F?F.letter:"—"}),(0,b.jsx)("span",{children:"Overall Grade"})]}),(0,b.jsxs)("div",{className:"summary-metric",children:[(0,b.jsx)("strong",{children:F?F.gpa.toFixed(1):"—"}),(0,b.jsx)("span",{children:"GPA (4.0 Scale)"})]}),(0,b.jsxs)("div",{className:"summary-metric",children:[(0,b.jsx)("strong",{children:null!==t?`${t}%`:"—"}),(0,b.jsx)("span",{children:"Attendance Rate"})]})]}),(0,b.jsx)("h3",{className:"report-section-title",children:"Academic Subject Performance"}),0===B.length?(0,b.jsx)("p",{className:"empty-state",style:{padding:"20px",textAlign:"center",color:"#64748b"},children:"No assessments have been recorded for this student in the current academic year."}):(0,b.jsxs)("table",{className:"report-card-table",children:[(0,b.jsx)("thead",{children:(0,b.jsxs)("tr",{children:[(0,b.jsx)("th",{children:"Subject"}),(0,b.jsx)("th",{children:"Assessment Tasks"}),(0,b.jsx)("th",{children:"Score Earned"}),(0,b.jsx)("th",{children:"Max Points"}),(0,b.jsx)("th",{children:"Percentage"}),(0,b.jsx)("th",{children:"Grade"}),(0,b.jsx)("th",{children:"Remark"})]})}),(0,b.jsx)("tbody",{children:B.map(a=>{let c=a.totalMax>0?Math.round(a.totalScore/a.totalMax*100):null,d=null!==c?k(c):null;return(0,b.jsxs)("tr",{children:[(0,b.jsxs)("td",{children:[(0,b.jsx)("strong",{children:a.subjectName}),a.subjectCode&&(0,b.jsx)("small",{style:{display:"block",color:"#64748b"},children:a.subjectCode})]}),(0,b.jsxs)("td",{children:[a.items.length," assessment",1===a.items.length?"":"s"]}),(0,b.jsx)("td",{children:a.totalScore}),(0,b.jsx)("td",{children:a.totalMax}),(0,b.jsx)("td",{children:null!==c?`${c}%`:"—"}),(0,b.jsx)("td",{children:d?(0,b.jsx)("span",{className:`grade-pill grade-${d.letter}`,children:d.letter}):"—"}),(0,b.jsx)("td",{children:d?d.remark:"Pending"})]},a.subjectName)})})]}),(0,b.jsx)("h3",{className:"report-section-title",children:"Attendance & Participation"}),(0,b.jsxs)("table",{className:"report-card-table",children:[(0,b.jsx)("thead",{children:(0,b.jsxs)("tr",{children:[(0,b.jsx)("th",{children:"Total Days Recorded"}),(0,b.jsx)("th",{children:"Present"}),(0,b.jsx)("th",{children:"Late"}),(0,b.jsx)("th",{children:"Excused"}),(0,b.jsx)("th",{children:"Absent"}),(0,b.jsx)("th",{children:"Overall Attendance"})]})}),(0,b.jsx)("tbody",{children:(0,b.jsxs)("tr",{children:[(0,b.jsx)("td",{children:(0,b.jsxs)("strong",{children:[s.total," days"]})}),(0,b.jsx)("td",{children:s.present}),(0,b.jsx)("td",{children:s.late}),(0,b.jsx)("td",{children:s.excused}),(0,b.jsx)("td",{children:s.absent}),(0,b.jsx)("td",{children:(0,b.jsx)("strong",{children:null!==t?`${t}%`:"No records"})})]})})]}),(0,b.jsxs)("div",{className:"signatures-area",children:[(0,b.jsxs)("div",{children:[(0,b.jsx)("div",{className:"signature-line"}),(0,b.jsx)("p",{children:(0,b.jsx)("strong",{children:"Class Teacher Signature"})})]}),(0,b.jsxs)("div",{children:[(0,b.jsx)("div",{className:"signature-line"}),(0,b.jsx)("p",{children:(0,b.jsx)("strong",{children:"School Principal / Administrator"})})]}),(0,b.jsxs)("div",{children:[(0,b.jsx)("div",{className:"signature-line"}),(0,b.jsx)("p",{children:(0,b.jsx)("strong",{children:"Parent / Guardian Signature"})})]})]})]})]})}a.s(["default",0,function({params:a}){return(0,b.jsx)(f.Suspense,{fallback:(0,b.jsx)("main",{className:"auth-page",children:(0,b.jsx)("p",{children:"Generating report card..."})}),children:a.then(({id:a})=>(0,b.jsx)(l,{studentId:a}))})},"metadata",0,{title:"Student Report Card | Forma"}])},73851,a=>{let b=(0,a.i(11857).registerClientReference)(function(){throw Error("Attempted to call PrintButton() from the server but PrintButton is on the client. It's not possible to invoke a client function from the server, it can only be rendered as a Component or passed to props of a Client Component.")},"[project]/src/app/(workspace)/students/[id]/report-card/print-button.tsx","PrintButton");a.s(["PrintButton",0,b])},77064,a=>{var b=a.i(73851);a.n(b)}],95707,function(a){a.n(a.i(38067))}];

//# sourceMappingURL=src_app_%28workspace%29_students_%5Bid%5D_report-card_0pyjsnka0in86._.js.map