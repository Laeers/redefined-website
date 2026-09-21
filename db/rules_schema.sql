-- Regler/sektioner gøres redigerbare fra hjemmesiden (Senior Admin+).
-- Kør mod redefined_web. Appen seeder selv det nuværende indhold første gang
-- (se lib/rules.ts -> seedRulesIfEmpty), så denne fil opretter kun skemaet.

CREATE TABLE IF NOT EXISTS rules_sections (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  slug        VARCHAR(64)  NOT NULL UNIQUE,
  nav_label   VARCHAR(128) NOT NULL DEFAULT '',
  eyebrow     VARCHAR(128) NOT NULL DEFAULT '',
  title       VARCHAR(255) NOT NULL DEFAULT '',
  body        MEDIUMTEXT   NOT NULL,            -- Markdown (GFM)
  position    INT          NOT NULL DEFAULT 0,
  is_published TINYINT(1)  NOT NULL DEFAULT 1,
  updated_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  updated_by  VARCHAR(64)  NULL,
  INDEX idx_position (position)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Side-header + CTA (key/value), så Senior Admin også kan redigere toppen.
CREATE TABLE IF NOT EXISTS rules_meta (
  k          VARCHAR(64) PRIMARY KEY,
  v          TEXT        NOT NULL,
  updated_at TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  updated_by VARCHAR(64) NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
