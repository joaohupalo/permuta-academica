CREATE TABLE `aula` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`turma_id` integer NOT NULL,
	`data` text NOT NULL,
	`horario` integer NOT NULL,
	`sala` text DEFAULT '' NOT NULL,
	`grupo` text NOT NULL,
	`disciplina_prevista_id` integer,
	`disciplina_atual_id` integer,
	`professor_atual_id` integer,
	`status` text DEFAULT 'normal' NOT NULL,
	`motivo` text,
	`pedido_pendente_id` integer,
	FOREIGN KEY (`turma_id`) REFERENCES `turma`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`disciplina_prevista_id`) REFERENCES `disciplina`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`disciplina_atual_id`) REFERENCES `disciplina`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`professor_atual_id`) REFERENCES `usuario`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `aula_turma_data_horario` ON `aula` (`turma_id`,`data`,`horario`);--> statement-breakpoint
CREATE INDEX `aula_grupo` ON `aula` (`grupo`);--> statement-breakpoint
CREATE INDEX `aula_data` ON `aula` (`data`);--> statement-breakpoint
CREATE TABLE `disciplina` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`nome` text NOT NULL,
	`professor_id` integer NOT NULL,
	`total_aulas` integer NOT NULL,
	FOREIGN KEY (`professor_id`) REFERENCES `usuario`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `disciplina_turma` (
	`disciplina_id` integer NOT NULL,
	`turma_id` integer NOT NULL,
	PRIMARY KEY(`disciplina_id`, `turma_id`),
	FOREIGN KEY (`disciplina_id`) REFERENCES `disciplina`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`turma_id`) REFERENCES `turma`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `evento` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`quando` text NOT NULL,
	`usuario_id` integer,
	`tipo` text NOT NULL,
	`descricao` text NOT NULL,
	`pedido_id` integer,
	`dados` text,
	FOREIGN KEY (`usuario_id`) REFERENCES `usuario`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `feriado` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`data` text NOT NULL,
	`descricao` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `feriado_data_unique` ON `feriado` (`data`);--> statement-breakpoint
CREATE TABLE `horario_fixo` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`disciplina_id` integer NOT NULL,
	`dia_semana` integer NOT NULL,
	`horario` integer NOT NULL,
	`sala` text DEFAULT '' NOT NULL,
	FOREIGN KEY (`disciplina_id`) REFERENCES `disciplina`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `pedido` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tipo` text NOT NULL,
	`solicitante_id` integer NOT NULL,
	`destinatario_id` integer NOT NULL,
	`aula_ofertada_id` integer NOT NULL,
	`aula_pedida_id` integer,
	`disciplina_destino_id` integer NOT NULL,
	`status` text DEFAULT 'pendente' NOT NULL,
	`criado_em` text NOT NULL,
	`respondido_em` text,
	FOREIGN KEY (`solicitante_id`) REFERENCES `usuario`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`destinatario_id`) REFERENCES `usuario`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`aula_ofertada_id`) REFERENCES `aula`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`aula_pedida_id`) REFERENCES `aula`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`disciplina_destino_id`) REFERENCES `disciplina`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `semestre` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`nome` text NOT NULL,
	`inicio` text NOT NULL,
	`fim` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `turma` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`nome` text NOT NULL,
	`curso` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `turma_nome_unique` ON `turma` (`nome`);--> statement-breakpoint
CREATE TABLE `usuario` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`nome` text NOT NULL,
	`email` text NOT NULL,
	`senha_hash` text NOT NULL,
	`papel` text DEFAULT 'professor' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `usuario_email_unique` ON `usuario` (`email`);