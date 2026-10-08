import { sqliteTable, text, integer, uniqueIndex, index } from 'drizzle-orm/sqlite-core';
export const messes = sqliteTable('messes', {
  id:text('id').primaryKey(), slug:text('slug').notNull().unique(), name:text('name').notNull(),
  caterer:text('caterer').notNull(), hostel:text('hostel').notNull(), category:text('category').notNull(),
  grace:integer('grace').notNull().default(15), active:integer('active').notNull().default(1),
});
export const users = sqliteTable('users', {
  id:text('id').primaryKey(), email:text('email').notNull().unique(), login:text('login').unique(),
  name:text('name').notNull(), registration:text('registration').unique(), role:text('role',{enum:['student','incharge','warden']}).notNull(),
  secret:text('secret').notNull(), messId:text('mess_id').references(()=>messes.id),
  verified:integer('verified').notNull().default(0), active:integer('active').notNull().default(1), created:integer('created').notNull(),
});
export const requests = sqliteTable('membership_requests', {
  id:text('id').primaryKey(), userId:text('user_id').notNull().references(()=>users.id), messId:text('mess_id').notNull().references(()=>messes.id),
  status:text('status').notNull().default('pending'), reviewer:text('reviewer').references(()=>users.id), created:integer('created').notNull(), decided:integer('decided'),
},t=>[index('requests_mess_status').on(t.messId,t.status)]);
export const sessions=sqliteTable('sessions',{hash:text('hash').primaryKey(),userId:text('user_id').notNull().references(()=>users.id),expires:integer('expires').notNull()});
export const challenges=sqliteTable('challenges',{id:text('id').primaryKey(),userId:text('user_id').notNull().references(()=>users.id),hash:text('hash').notNull(),expires:integer('expires').notNull(),attempts:integer('attempts').notNull().default(0),used:integer('used').notNull().default(0)});
export const meals=sqliteTable('meals',{
  id:text('id').primaryKey(),messId:text('mess_id').notNull().references(()=>messes.id),date:text('date').notNull(),slot:text('slot').notNull(),
  items:text('items').notNull(),source:text('source').notNull(),start:integer('start').notNull(),end:integer('end').notNull(),deadline:integer('deadline').notNull(),imported:integer('imported').notNull(),
},t=>[uniqueIndex('meal_slot_unique').on(t.messId,t.date,t.slot),index('meals_deadline').on(t.deadline)]);
export const captureTickets=sqliteTable('capture_tickets',{id:text('id').primaryKey(),userId:text('user_id').notNull().references(()=>users.id),mealId:text('meal_id').notNull().references(()=>meals.id),expires:integer('expires').notNull(),used:integer('used').notNull().default(0)});
export const proofs=sqliteTable('proofs',{id:text('id').primaryKey(),mealId:text('meal_id').notNull().unique().references(()=>meals.id),userId:text('user_id').notNull().references(()=>users.id),objectKey:text('object_key').notNull(),digest:text('digest').notNull().unique(),received:integer('received').notNull(),clientCaptured:integer('client_captured').notNull()});
export const warnings=sqliteTable('warnings',{id:text('id').primaryKey(),mealId:text('meal_id').notNull().unique().references(()=>meals.id),created:integer('created').notNull(),resolved:integer('resolved'),response:text('response'),reviewer:text('reviewer').references(()=>users.id)});
export const outbox=sqliteTable('outbox',{id:text('id').primaryKey(),recipient:text('recipient').notNull(),subject:text('subject').notNull(),body:text('body').notNull(),created:integer('created').notNull(),sent:integer('sent'),attempts:integer('attempts').notNull().default(0),nextAttempt:integer('next_attempt').notNull().default(0),lease:integer('lease').notNull().default(0),lastError:text('last_error')});
export const surveys=sqliteTable('surveys',{id:text('id').primaryKey(),userId:text('user_id').notNull().references(()=>users.id),messId:text('mess_id').notNull().references(()=>messes.id),month:text('month').notNull(),taste:integer('taste').notNull(),quantity:integer('quantity').notNull(),hygiene:integer('hygiene').notNull(),timing:integer('timing').notNull(),comment:text('comment').notNull(),created:integer('created').notNull()},t=>[uniqueIndex('survey_once').on(t.userId,t.month),index('survey_mess_month').on(t.messId,t.month)]);
export const suggestions=sqliteTable('suggestions',{id:text('id').primaryKey(),userId:text('user_id').notNull().references(()=>users.id),messId:text('mess_id').notNull().references(()=>messes.id),month:text('month').notNull(),dish:text('dish').notNull(),normalized:text('normalized').notNull(),credit:integer('credit').notNull(),created:integer('created').notNull()},t=>[uniqueIndex('suggestion_once').on(t.userId,t.month),index('suggestions_mess_month').on(t.messId,t.month)]);
export const votes=sqliteTable('votes',{id:text('id').primaryKey(),userId:text('user_id').notNull().references(()=>users.id),messId:text('mess_id').notNull().references(()=>messes.id),month:text('month').notNull(),dish:text('dish').notNull(),created:integer('created').notNull()},t=>[uniqueIndex('vote_once').on(t.userId,t.month),index('votes_mess_month').on(t.messId,t.month)]);
export const festivals=sqliteTable('festivals',{id:text('id').primaryKey(),date:text('date').notNull(),name:text('name').notNull(),source:text('source').notNull(),messId:text('mess_id').references(()=>messes.id),items:text('items').notNull()},t=>[index('festivals_date').on(t.date)]);
export const audit=sqliteTable('audit',{id:text('id').primaryKey(),actor:text('actor'),messId:text('mess_id'),event:text('event').notNull(),details:text('details').notNull(),created:integer('created').notNull()},t=>[index('audit_mess_created').on(t.messId,t.created)]);
export const limits=sqliteTable('rate_limits',{key:text('key').primaryKey(),count:integer('count').notNull(),expires:integer('expires').notNull()});
