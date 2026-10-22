import type { MaterialContent, MaterialKind } from "@/lib/ai-materials";

// Renders the structured material Claude wrote. Text is shown as written; new lines are kept by
// the .material-text style, so no markdown or HTML from the model is interpreted.

function Text({ children }: { children: string }) {
  return <p className="material-text">{children}</p>;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="material-section"><h3>{title}</h3>{children}</section>;
}

function List({ items }: { items: string[] }) {
  return <ul className="material-list">{items.map((item, index) => <li key={index}>{item}</li>)}</ul>;
}

export function MaterialView({ kind, content }: { kind: MaterialKind; content: unknown }) {
  switch (kind) {
    case "lesson_plan": {
      const plan = content as MaterialContent["lesson_plan"];
      return (
        <div className="material-body">
          <p className="material-meta">{plan.unitTopic} · {plan.durationMinutes} minutes · Textbook {plan.textbookPages}</p>
          <Section title="Overview"><Text>{plan.overview}</Text></Section>
          <Section title="Learning objectives"><List items={plan.objectives} /></Section>
          <Section title="Materials"><List items={plan.materials} /></Section>
          <Section title="Prerequisites"><Text>{plan.prerequisites}</Text></Section>
          <Section title="Procedure">
            <table className="material-table">
              <thead><tr><th>Phase</th><th>Min</th><th>Teacher</th><th>Students</th></tr></thead>
              <tbody>{plan.procedure.map((step, index) => (
                <tr key={index}><td>{step.phase}</td><td>{step.minutes}</td><td className="material-text">{step.teacherActivity}</td><td className="material-text">{step.studentActivity}</td></tr>
              ))}</tbody>
            </table>
          </Section>
          <Section title="Differentiation"><Text>{plan.differentiation}</Text></Section>
          <Section title="Checking understanding"><Text>{plan.assessment}</Text></Section>
          <Section title="Homework"><Text>{plan.homework}</Text></Section>
        </div>
      );
    }
    case "lecture_notes": {
      const notes = content as MaterialContent["lecture_notes"];
      return (
        <div className="material-body">
          <p className="material-meta">Textbook {notes.textbookPages}</p>
          <Section title="Summary"><Text>{notes.summary}</Text></Section>
          {notes.sections.map((section, index) => <Section key={index} title={section.heading}><Text>{section.body}</Text></Section>)}
          <Section title="Key terms">
            <dl className="material-terms">{notes.keyTerms.map((term, index) => (
              <div key={index}><dt>{term.term}</dt><dd>{term.definition}</dd></div>
            ))}</dl>
          </Section>
          <Section title="Review questions"><ol className="material-list">{notes.reviewQuestions.map((question, index) => <li key={index}>{question}</li>)}</ol></Section>
        </div>
      );
    }
    case "assignment": {
      const assignment = content as MaterialContent["assignment"];
      const total = assignment.tasks.reduce((sum, task) => sum + task.marks, 0);
      return (
        <div className="material-body">
          <p className="material-meta">{total} marks · Textbook {assignment.textbookPages}</p>
          <Section title="Instructions"><Text>{assignment.instructions}</Text></Section>
          <Section title="Tasks">
            <ol className="material-list">{assignment.tasks.map((task, index) => (
              <li key={index}><span className="material-text">{task.prompt}</span> <strong>({task.marks} marks)</strong></li>
            ))}</ol>
          </Section>
          <Section title="Marking guide (teacher only)">
            <ol className="material-list">{assignment.tasks.map((task, index) => <li className="material-text" key={index}>{task.expectedAnswer}</li>)}</ol>
            <Text>{assignment.rubric}</Text>
          </Section>
        </div>
      );
    }
    case "exam": {
      const exam = content as MaterialContent["exam"];
      const total = exam.multipleChoice.reduce((sum, question) => sum + question.points, 0) + exam.shortAnswer.reduce((sum, question) => sum + question.marks, 0);
      return (
        <div className="material-body">
          <p className="material-meta">{exam.durationMinutes} minutes · {total} marks · Textbook {exam.textbookPages}</p>
          <Section title="Instructions"><Text>{exam.instructions}</Text></Section>
          <Section title="Part I: Multiple choice">
            <ol className="material-list">{exam.multipleChoice.map((question, index) => (
              <li key={index}>
                <span className="material-text">{question.question}</span>
                <ol className="material-options" type="A">{question.options.map((option, optionIndex) => <li key={optionIndex}>{option}</li>)}</ol>
              </li>
            ))}</ol>
          </Section>
          {exam.shortAnswer.length > 0 && (
            <Section title="Part II: Short answer">
              <ol className="material-list">{exam.shortAnswer.map((question, index) => (
                <li key={index}><span className="material-text">{question.question}</span> <strong>({question.marks} marks)</strong></li>
              ))}</ol>
            </Section>
          )}
          <Section title="Answer key (teacher only)">
            <ol className="material-list">{exam.multipleChoice.map((question, index) => (
              <li key={index}>{String.fromCharCode(65 + question.correctOption)}: {question.explanation}</li>
            ))}</ol>
            {exam.shortAnswer.length > 0 && <ol className="material-list">{exam.shortAnswer.map((question, index) => <li className="material-text" key={index}>{question.modelAnswer}</li>)}</ol>}
          </Section>
        </div>
      );
    }
  }
}
