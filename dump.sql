PRAGMA foreign_keys=OFF;
BEGIN TRANSACTION;
CREATE TABLE projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      working_directory TEXT,
      start_command TEXT NOT NULL,
      stop_command TEXT
    );
INSERT INTO projects VALUES(1,'Allocateit Web','','C:\Software_Dev\Allocateit\web-app','npm run dev:all','');
INSERT INTO sqlite_sequence VALUES('projects',1);
COMMIT;
