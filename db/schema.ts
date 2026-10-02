import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const volunteers = sqliteTable("volunteers", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  owner: text("owner").notNull(),
  cpf: text("cpf").notNull(),
  name: text("name").notNull(),
  email: text("email").notNull().default(""),
  niche: text("niche").notNull(),
  nicheKey: text("niche_key").notNull().default(""),
  company: text("company").notNull().default(""),
  address: text("address").notNull().default(""),
  city: text("city").notNull().default(""),
  phone: text("phone").notNull().default(""),
  availability: text("availability").notNull().default(""),
  status: text("status").notNull().default("Em análise"),
  stage: text("stage").notNull().default("Inscrição"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [
  uniqueIndex("idx_volunteers_owner_cpf").on(table.owner, table.cpf),
]);

export const staffSessions = sqliteTable("staff_sessions", {
  token: text("token").primaryKey(),
  displayName: text("display_name").notNull(),
  expiresAt: text("expires_at").notNull(),
  createdAt: text("created_at").notNull(),
});

export const partners = sqliteTable("partners", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  owner: text("owner").notNull(),
  name: text("name").notNull(),
  kind: text("kind").notNull(),
  createdAt: text("created_at").notNull(),
});

export const actions = sqliteTable("actions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  owner: text("owner").notNull(),
  title: text("title").notNull(),
  partnerId: integer("partner_id"),
  volunteerCpf: text("volunteer_cpf").notNull().default(""),
  scheduledAt: text("scheduled_at").notNull(),
  participants: integer("participants").notNull(),
  department: text("department").notNull(),
  sourceChannel: text("source_channel").notNull(),
  documents: text("documents").notNull().default("Pendente"),
  status: text("status").notNull().default("Solicitada"),
  notes: text("notes").notNull().default(""),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const donations = sqliteTable("donations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  owner: text("owner").notNull(),
  donor: text("donor").notNull(),
  item: text("item").notNull(),
  unit: text("unit").notNull(),
  quantityReceived: integer("quantity_received").notNull(),
  quantityDistributed: integer("quantity_distributed").notNull().default(0),
  purpose: text("purpose").notNull(),
  receivedAt: text("received_at").notNull(),
});

export const donationMovements = sqliteTable("donation_movements", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  owner: text("owner").notNull(),
  donationId: integer("donation_id").notNull(),
  kind: text("kind").notNull(),
  quantity: integer("quantity").notNull(),
  destination: text("destination").notNull().default(""),
  createdAt: text("created_at").notNull(),
});

export const activityLog = sqliteTable("activity_log", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  owner: text("owner").notNull(),
  category: text("category").notNull(),
  detail: text("detail").notNull(),
  createdAt: text("created_at").notNull(),
});

export const chatTickets = sqliteTable("chat_tickets", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  visitor: text("visitor").notNull(),
  guestName: text("guest_name").notNull(),
  status: text("status").notNull().default("waiting"),
  claimedBy: text("claimed_by").notNull().default(""),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const chatMessages = sqliteTable("chat_messages", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  ticketId: integer("ticket_id").notNull(),
  sender: text("sender").notNull(),
  body: text("body").notNull(),
  createdAt: text("created_at").notNull(),
});
