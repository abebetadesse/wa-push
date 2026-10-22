import type { Metadata } from "next";
import { and, asc, count, desc, eq, isNotNull, isNull, like, or } from "drizzle-orm";
import Form from "next/form";
import Link from "next/link";
import { Suspense } from "react";
import { ActionForm } from "@/components/action-form";
import { activeTab, PageTabs } from "@/components/page-tabs";
import { RecordForm, RowButton } from "@/components/record-form";
import { SchoolPicker, selectedSchool } from "@/components/school-picker";
import { SubmitButton } from "@/components/submit-button";
import { db } from "@/db";
import { gradeLevels, libraryBooks, libraryLoans, staffMembers, students, subjects } from "@/db/schema";
import { addDays } from "@/lib/format";
import { pageRoles, requireSchoolsFor } from "@/lib/workspace";
import { addBook, issueLoan, returnLoan, setCopies } from "./actions";

export const metadata: Metadata = { title: "Library | Forma" };

const TABS = ["catalog", "loans", "history"] as const;
type SearchParams = Promise<{ schoolId?: string; tab?: string; q?: string }>;

async function LibraryContent({ searchParams }: { searchParams: SearchParams }) {
  const { schoolIds, schools: visibleSchools } = await requireSchoolsFor(pageRoles.library);
  const params = await searchParams;
  const schoolId = selectedSchool(params.schoolId, schoolIds);
  const tab = activeTab(params.tab, TABS);
  const query = (params.q ?? "").trim().slice(0, 100);
  const today = new Date().toISOString().slice(0, 10);

  const bookFilter = query
    ? and(eq(libraryBooks.schoolId, schoolId), or(like(libraryBooks.title, `%${query}%`), like(libraryBooks.author, `%${query}%`), like(libraryBooks.isbn, `%${query}%`)))
    : eq(libraryBooks.schoolId, schoolId);
  const [books, onLoanCounts, activeLoans, returnedLoans, grades, schoolSubjects, studentRows, staffRows] = await Promise.all([
    db.select({ book: libraryBooks, gradeName: gradeLevels.name, subjectName: subjects.name }).from(libraryBooks)
      .leftJoin(gradeLevels, eq(gradeLevels.id, libraryBooks.gradeLevelId))
      .leftJoin(subjects, eq(subjects.id, libraryBooks.subjectId))
      .where(bookFilter).orderBy(asc(libraryBooks.title)).limit(500),
    db.select({ bookId: libraryLoans.bookId, total: count() }).from(libraryLoans)
      .where(and(eq(libraryLoans.schoolId, schoolId), isNull(libraryLoans.returnedOn))).groupBy(libraryLoans.bookId),
    db.select({ loan: libraryLoans, title: libraryBooks.title }).from(libraryLoans)
      .innerJoin(libraryBooks, eq(libraryBooks.id, libraryLoans.bookId))
      .where(and(eq(libraryLoans.schoolId, schoolId), isNull(libraryLoans.returnedOn))).orderBy(asc(libraryLoans.dueOn)),
    tab === "history"
      ? db.select({ loan: libraryLoans, title: libraryBooks.title }).from(libraryLoans)
        .innerJoin(libraryBooks, eq(libraryBooks.id, libraryLoans.bookId))
        .where(and(eq(libraryLoans.schoolId, schoolId), isNotNull(libraryLoans.returnedOn))).orderBy(desc(libraryLoans.returnedOn)).limit(200)
      : Promise.resolve([]),
    db.select({ id: gradeLevels.id, name: gradeLevels.name }).from(gradeLevels).where(eq(gradeLevels.schoolId, schoolId)).orderBy(gradeLevels.sortOrder),
    db.select({ id: subjects.id, name: subjects.name }).from(subjects).where(eq(subjects.schoolId, schoolId)).orderBy(subjects.name),
    db.select({ id: students.id, firstName: students.firstName, lastName: students.lastName, number: students.studentNumber }).from(students)
      .where(and(eq(students.schoolId, schoolId), eq(students.status, "active"))).orderBy(students.lastName),
    db.select({ id: staffMembers.id, firstName: staffMembers.firstName, lastName: staffMembers.lastName, jobTitle: staffMembers.jobTitle }).from(staffMembers)
      .where(and(eq(staffMembers.schoolId, schoolId), eq(staffMembers.status, "active"))).orderBy(staffMembers.lastName),
  ]);
  const onLoan = new Map(onLoanCounts.map((row) => [row.bookId, row.total]));
  const totalCopies = books.reduce((sum, { book }) => sum + book.copies, 0);
  const overdue = activeLoans.filter(({ loan }) => loan.dueOn < today).length;
  const availableBooks = books.filter(({ book }) => book.copies > (onLoan.get(book.id) ?? 0));
  const borrowerOptions = [
    ...studentRows.map((student) => ({ value: `student:${student.id}`, label: `Student · ${student.firstName} ${student.lastName} (${student.number})` })),
    ...staffRows.map((staff) => ({ value: `staff:${staff.id}`, label: `Staff · ${staff.firstName} ${staff.lastName}, ${staff.jobTitle}` })),
  ];

  return (
    <main className="management-page">
      <header className="management-header">
        <div>
          <Link href="/" className="management-back">← Dashboard</Link>
          <p className="auth-eyebrow">SCHOOL OPERATIONS</p>
          <h1>Library</h1>
          <p className="management-description">Keep the book catalog, lend copies to students and staff, and follow up overdue loans.</p>
        </div>
      </header>
      <SchoolPicker basePath="/library" keep={{ tab }} schools={visibleSchools} selected={schoolId} />
      <div className="textbook-summary">
        <div><strong>{books.length}</strong><span>titles{query ? " matching" : ""}</span></div>
        <div><strong>{totalCopies}</strong><span>copies</span></div>
        <div><strong>{activeLoans.length}</strong><span>on loan</span></div>
        <div><strong>{overdue}</strong><span>overdue</span></div>
      </div>
      <PageTabs active={tab} basePath="/library" params={{ schoolId }} tabs={[
        { id: "catalog", label: "Catalog" },
        { id: "loans", label: "Loans", count: activeLoans.length || undefined },
        { id: "history", label: "Returned" },
      ]} />
      <div className="management-sections">
        {tab === "catalog" && <>
          <section className="management-card">
            <h2>Add a book</h2>
            <RecordForm action={addBook} hidden={{ schoolId }} submitLabel="Add to catalog" fields={[
              { name: "title", label: "Title", required: true, max: 200, wide: true },
              { name: "author", label: "Author", max: 160 },
              { name: "isbn", label: "ISBN", max: 20 },
              { name: "publisher", label: "Publisher", max: 160 },
              { name: "publishedYear", label: "Year", type: "number", min: 1800, max: 2100 },
              { name: "category", label: "Category", max: 80, placeholder: "Textbook, fiction, reference…" },
              { name: "language", label: "Language", max: 40 },
              { name: "gradeLevelId", label: "Grade", type: "select", options: grades.map((grade) => ({ value: grade.id, label: grade.name })) },
              { name: "subjectId", label: "Subject", type: "select", options: schoolSubjects.map((subject) => ({ value: subject.id, label: subject.name })) },
              { name: "shelf", label: "Shelf", max: 40 },
              { name: "copies", label: "Copies", type: "number", required: true, min: 1, max: 10000, defaultValue: "1" },
            ]} />
          </section>
          <section className="management-card">
            <div className="management-card-heading"><div><h2>Catalog</h2><p>{books.length} title{books.length === 1 ? "" : "s"}</p></div></div>
            <Form action="/library" className="auth-form attendance-filter">
              <input name="schoolId" type="hidden" value={schoolId} />
              <label>Search<input defaultValue={query} maxLength={100} name="q" placeholder="Title, author or ISBN" /></label>
              <button className="secondary-button" type="submit">Search</button>
            </Form>
            {books.length === 0 ? <p className="empty-state">{query ? "No books match." : "The catalog is empty."}</p> : <div className="record-list">{books.map(({ book, gradeName, subjectName }) => {
              const lent = onLoan.get(book.id) ?? 0;
              return (
                <div className="record-row" key={book.id}>
                  <div><strong>{book.title}</strong>
                    <small>{[book.author, book.publisher, book.publishedYear, book.isbn && `ISBN ${book.isbn}`, gradeName, subjectName, book.category, book.language, book.shelf && `Shelf ${book.shelf}`].filter(Boolean).join(" · ")}</small></div>
                  <span className={`role-badge status-${book.copies > lent ? "active" : "inactive"}`}>{book.copies - lent} of {book.copies} in</span>
                  <ActionForm action={setCopies} className="inline-actions">
                    <input name="schoolId" type="hidden" value={schoolId} />
                    <input name="bookId" type="hidden" value={book.id} />
                    <input aria-label={`Copies of ${book.title}`} className="number-input" defaultValue={book.copies} max={10000} min={lent} name="copies" type="number" />
                    <SubmitButton pendingLabel="Saving…">Set copies</SubmitButton>
                  </ActionForm>
                </div>
              );
            })}</div>}
          </section>
        </>}

        {tab === "loans" && <>
          <section className="management-card">
            <h2>Lend a book</h2>
            {availableBooks.length === 0 || borrowerOptions.length === 0
              ? <p className="empty-state">{availableBooks.length === 0 ? "No copies are available to lend." : "Add students or staff before lending."}</p>
              : <RecordForm action={issueLoan} hidden={{ schoolId }} submitLabel="Lend" fields={[
                { name: "bookId", label: "Book", type: "select", required: true, wide: true, options: availableBooks.map(({ book }) => ({ value: book.id, label: `${book.title}${book.author ? ` · ${book.author}` : ""} (${book.copies - (onLoan.get(book.id) ?? 0)} in)` })) },
                { name: "borrower", label: "Borrower", type: "select", required: true, wide: true, options: borrowerOptions },
                { name: "dueOn", label: "Due date", type: "date", defaultValue: addDays(today, 14) },
              ]} />}
          </section>
          <section className="management-card">
            <div className="management-card-heading"><div><h2>On loan</h2><p>{activeLoans.length} loan{activeLoans.length === 1 ? "" : "s"} · {overdue} overdue</p></div></div>
            {activeLoans.length === 0 ? <p className="empty-state">Nothing is on loan.</p> : <div className="record-list">{activeLoans.map(({ loan, title }) => (
              <div className="record-row" key={loan.id}>
                <div><strong>{title}</strong><small>{loan.borrowerName} ({loan.borrowerType}) · lent {loan.loanedOn} · due {loan.dueOn}</small></div>
                <span className={`role-badge status-${loan.dueOn < today ? "inactive" : "active"}`}>{loan.dueOn < today ? "overdue" : "on loan"}</span>
                <span className="inline-actions">
                  <RowButton action={returnLoan} hidden={{ schoolId, loanId: loan.id, action: "renew" }} label="Renew 14 days" />
                  <RowButton action={returnLoan} hidden={{ schoolId, loanId: loan.id, action: "return" }} label="Returned" />
                </span>
              </div>
            ))}</div>}
          </section>
        </>}

        {tab === "history" && (
          <section className="management-card">
            <div className="management-card-heading"><div><h2>Returned</h2><p>The last {returnedLoans.length} returns</p></div></div>
            {returnedLoans.length === 0 ? <p className="empty-state">No returns yet.</p> : <div className="record-list">{returnedLoans.map(({ loan, title }) => (
              <div className="record-row" key={loan.id}>
                <div><strong>{title}</strong><small>{loan.borrowerName} · {loan.loanedOn} to {loan.returnedOn}{loan.returnedOn! > loan.dueOn ? ` (late, due ${loan.dueOn})` : ""}</small></div>
              </div>
            ))}</div>}
          </section>
        )}
      </div>
    </main>
  );
}

export default function LibraryPage({ searchParams }: { searchParams: SearchParams }) {
  return <Suspense fallback={<main className="auth-page"><p>Loading library...</p></main>}><LibraryContent searchParams={searchParams} /></Suspense>;
}
