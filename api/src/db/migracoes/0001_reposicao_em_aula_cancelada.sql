DROP INDEX `aula_turma_data_horario`;--> statement-breakpoint
CREATE UNIQUE INDEX `aula_turma_data_horario_ativa` ON `aula` (`turma_id`,`data`,`horario`) WHERE status <> 'cancelada';