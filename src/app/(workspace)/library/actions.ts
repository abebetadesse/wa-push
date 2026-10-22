"use server";

import { guardAction, UserError, type ActionState } from "@/lib/action-result";

import { and, count, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { activityEvents, gradeLevels, libraryBooks, libraryLoans, staffMembers, students, subjects } from "@/db/schema";
import { isDuplicateEntry } from "@/lib/db-errors";
import { formFields } from "@/lib/form-fields";
import { addDays } from "@/lib/format";
import { requireSchoolRole } from "@/lib/permissions";

const LIBRARY_ROLES = ["school_admin", "librarian"] as const;

async function belongs(table: typeof gradeLevels | typeof subjects, id: string | null, schoolId: string) {
  if (!id) return null;
  const [row] = await db.select({ id: table.id }).from(table).where(and(eq(table.id, id), eq(table.schoolId, schoolId))).limit(1);
  if (!row) throw new UserError("That grade or subject isn't set up at this school.");
  return row.id;
}

async function addBookImpl(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const f = formFields(formData);
  const schoolId = f.id("schoolId", "a school");
  const { session } = await requireSchoolRole(schoolId, LIBRARY_ROLES);
  const title = f.text("title", "the title", 200);
  const isbn = f.optional("isbn", "the ISBN", 20)?.replace(/[\s-]/g, "") || null;
  if (isbn && !/^(\d{9}[\dX]|\d{13})$/i.test(isbn)) throw new UserError("Enter a 10- or 13-digit ISBN, or leave it empty.");
  const book = {
    schoolId,
    title,
    isbn,
    author: f.optional("author", "the author", 160),
    publisher: f.optional("publisher", "the publisher", 160),
    publishedYear: f.optionalInt("publishedYear", "the year", { min: 1800, max: 2100 }),
    category: f.optional("category", "the category", 80),
    language: f.optional("language", "the language", 40),
    shelf: f.optional("shelf", "the shelf", 40),
    copies: f.int("copies", "the number of copies", { min: 1, max: 10_000 }),
    gradeLevelId: await belongs(gradeLevels, f.optionalId("gradeLevelId", "a grade"), schoolId),
    subjectId: await belongs(subjects, f.optionalId("subjectId", "a subject"), schoolId),
  };
  try {
    await db.transaction(async (tx) => {
      await tx.insert(libraryBooks).values(book);
      await tx.insert(activityEvents).values({ schoolId, userId: session.user.id, detail: `Added ${book.copies} cop${book.copies === 1 ? "y" : "ies"} of “${title}” to the library`.slice(0, 255) });
    });
  } catch (error) {
    if (isDuplicateEntry(error)) return { error: "A book with this ISBN is already in the catalog. Change its number of copies instead." };
    throw error;
  }
  revalidatePath("/library");
  return { success: `“${title}” was added to the catalog.` };
}

async function setCopiesImpl(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const f = formFields(formData);
  const schoolId = f.id("schoolId", "a school");
  await requireSchoolRole(schoolId, LIBRARY_ROLES);
  const bookId = f.id("bookId", "a book");
  const copies = f.int("copies", "the number of copies", { min: 0, max: 10_000 });
  const [onLoan] = await db.select({ total: count() }).from(libraryLoans)
    .where(and(eq(libraryLoans.bookId, bookId), eq(libraryLoans.schoolId, schoolId), isNull(libraryLoans.returnedOn)));
  if (copies < onLoan.total) {
    throw new UserError(`${onLoan.total} ${onLoan.total === 1 ? "copy is" : "copies are"} on loan; the library can't hold fewer than that.`);
  }
  await db.update(libraryBooks).set({ copies }).where(and(eq(libraryBooks.id, bookId), eq(libraryBooks.schoolId, schoolId)));
  revalidatePath("/library");
  return {};
}

async function issueLoanImpl(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const f = formFields(formData);
  const schoolId = f.id("schoolId", "a school");
  const { session } = await requireSchoolRole(schoolId, LIBRARY_ROLES);
  const bookId = f.id("bookId", "a book");
  const [borrowerType, borrowerId] = f.text("borrower", "a borrower", 50).split(":");
  if ((borrowerType !== "student" && borrowerType !== "staff") || !/^[0-9a-f-]{36}$/i.test(borrowerId ?? "")) throw new UserError("Choose a borrower.");
  const today = new Date().toISOString().slice(0, 10);
  const dueOn = f.optionalDate("dueOn", "due date") ?? addDays(today, 14);
  if (dueOn < today) throw new UserError("The due date can't be in the past.");

  const [borrower] = borrowerType === "student"
    ? await db.select({ name: students.firstName, last: students.lastName }).from(students)
      .where(and(eq(students.id, borrowerId), eq(students.schoolId, schoolId), eq(students.status, "active"))).limit(1)
    : await db.select({ name: staffMembers.firstName, last: staffMembers.lastName }).from(staffMembers)
      .where(and(eq(staffMembers.id, borrowerId), eq(staffMembers.schoolId, schoolId))).limit(1);
  if (!borrower) throw new UserError("That borrower isn't an active member of this school.");
  const borrowerName = `${borrower.name} ${borrower.last}`;

  const title = await db.transaction(async (tx) => {
    // Locking the book row keeps two loans from taking the last copy at the same moment.
    const [book] = await tx.select({ title: libraryBooks.title, copies: libraryBooks.copies }).from(libraryBooks)
      .where(and(eq(libraryBooks.id, bookId), eq(libraryBooks.schoolId, schoolId))).limit(1).for("update");
    if (!book) throw new UserError("That book isn't in this library.");
    const [onLoan] = await tx.select({ total: count() }).from(libraryLoans)
      .where(and(eq(libraryLoans.bookId, bookId), isNull(libraryLoans.returnedOn)));
    if (onLoan.total >= book.copies) throw new UserError(`Every copy of “${book.title}” is on loan.`);
    await tx.insert(libraryLoans).values({
      schoolId,
      bookId,
      borrowerType,
      studentId: borrowerType === "student" ? borrowerId : null,
      staffId: borrowerType === "staff" ? borrowerId : null,
      borrowerName,
      loanedOn: today,
      dueOn,
      issuedBy: session.user.id,
    });
    await tx.insert(activityEvents).values({ schoolId, userId: session.user.id, detail: `Lent “${book.title}” to ${borrowerName}`.slice(0, 255) });
    return book.title;
  });
  revalidatePath("/library");
  return { success: `“${title}” lent to ${borrowerName}, due ${dueOn}.` };
}

async function returnLoanImpl(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const f = formFields(formData);
  const schoolId = f.id("schoolId", "a school");
  const { session } = await requireSchoolRole(schoolId, LIBRARY_ROLES);
  const loanId = f.id("loanId", "a loan");
  const action = f.choice("action", "an action", ["return", "renew"] as const);
  const [loan] = await db.select({ dueOn: libraryLoans.dueOn, returnedOn: libraryLoans.returnedOn, borrowerName: libraryLoans.borrowerName })
    .from(libraryLoans).where(and(eq(libraryLoans.id, loanId), eq(libraryLoans.schoolId, schoolId))).limit(1);
  if (!loan) throw new UserError("Loan not found.");
  if (loan.returnedOn) throw new UserError("This book was already returned.");
  const today = new Date().toISOString().slice(0, 10);
  if (action === "return") {
    await db.transaction(async (tx) => {
      await tx.update(libraryLoans).set({ returnedOn: today }).where(eq(libraryLoans.id, loanId));
      await tx.insert(activityEvents).values({ schoolId, userId: session.user.id, detail: `Recorded a library return from ${loan.borrowerName}`.slice(0, 255) });
    });
  } else {
    await db.update(libraryLoans).set({ dueOn: addDays(loan.dueOn > today ? loan.dueOn : today, 14) }).where(eq(libraryLoans.id, loanId));
  }
  revalidatePath("/library");
  return {};
}

// Every action runs through guardAction, so a failure reaches the form as a message instead of
// a blank HTTP 500 (Next.js hides thrown messages in production).
export async function addBook(...args: Parameters<typeof addBookImpl>) {
  return guardAction(() => addBookImpl(...args));
}
export async function setCopies(...args: Parameters<typeof setCopiesImpl>) {
  return guardAction(() => setCopiesImpl(...args));
}
export async function issueLoan(...args: Parameters<typeof issueLoanImpl>) {
  return guardAction(() => issueLoanImpl(...args));
}
export async function returnLoan(...args: Parameters<typeof returnLoanImpl>) {
  return guardAction(() => returnLoanImpl(...args));
}
