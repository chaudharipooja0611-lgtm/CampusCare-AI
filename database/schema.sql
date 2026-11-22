-- CampusCare AI - MySQL schema
CREATE DATABASE IF NOT EXISTS campuscare_ai CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE campuscare_ai;

CREATE TABLE IF NOT EXISTS departments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  category VARCHAR(30) NOT NULL,              -- AI category routed to this department
  description VARCHAR(255) NULL,
  email VARCHAR(120) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_dept_category (category)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(120) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('student','department','admin') NOT NULL DEFAULT 'student',
  department_id INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_user_dept FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS complaints (
  id INT AUTO_INCREMENT PRIMARY KEY,
  ticket_id VARCHAR(24) NOT NULL UNIQUE,
  user_id INT NOT NULL,
  title VARCHAR(150) NOT NULL,
  description TEXT NOT NULL,
  location VARCHAR(120) NOT NULL,
  image_path VARCHAR(255) NULL,
  category VARCHAR(30) NOT NULL,
  predicted_category VARCHAR(30) NOT NULL,     -- original AI output (kept after manual correction)
  priority VARCHAR(10) NOT NULL,
  confidence FLOAT NOT NULL,
  sentiment VARCHAR(15) NOT NULL,
  sentiment_score FLOAT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'Assigned',
  department_id INT NULL,
  duplicate_of INT NULL,
  duplicate_score FLOAT NULL,
  is_corrected TINYINT(1) NOT NULL DEFAULT 0,
  resolved_at DATETIME NULL,
  sla_due_at DATETIME NULL,                    -- resolution deadline derived from priority
  sla_breached_at DATETIME NULL,               -- set once by the SLA monitor
  sla_warned_at DATETIME NULL,
  escalation_level TINYINT NOT NULL DEFAULT 0, -- 0 none, 1 escalated, 2 critical
  escalated_at DATETIME NULL,
  escalation_reason VARCHAR(255) NULL,
  rating TINYINT NULL,                         -- student resolution rating 1 to 5
  feedback VARCHAR(500) NULL,
  rated_at DATETIME NULL,
  explanation MEDIUMTEXT NULL,                 -- JSON: why the model predicted this category and priority
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_c_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_c_dept FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL,
  INDEX idx_c_status (status), INDEX idx_c_category (category), INDEX idx_c_priority (priority),
  INDEX idx_c_created (created_at),
  INDEX idx_c_sla (status, sla_due_at),
  INDEX idx_c_escalation (escalation_level)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS complaint_updates (
  id INT AUTO_INCREMENT PRIMARY KEY,
  complaint_id INT NOT NULL,
  user_id INT NULL,
  status VARCHAR(20) NOT NULL,
  note VARCHAR(500) NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_u_complaint FOREIGN KEY (complaint_id) REFERENCES complaints(id) ON DELETE CASCADE,
  CONSTRAINT fk_u_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS notifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  complaint_id INT NULL,
  message VARCHAR(255) NOT NULL,
  type VARCHAR(20) NOT NULL DEFAULT 'info',
  severity VARCHAR(10) NOT NULL DEFAULT 'info',
  is_read TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_n_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_n_complaint FOREIGN KEY (complaint_id) REFERENCES complaints(id) ON DELETE CASCADE,
  INDEX idx_n_user (user_id, is_read),
  INDEX idx_n_created (user_id, created_at)
) ENGINE=InnoDB;

INSERT IGNORE INTO departments (name, category, description, email) VALUES
 ('IT & Network Services', 'Technical',   'Wi-Fi, computers, portals and software support', 'it@campus.edu'),
 ('Electrical Department', 'Electrical',  'Power supply, wiring, lighting and appliances',   'electrical@campus.edu'),
 ('Maintenance & Estates', 'Maintenance', 'Buildings, plumbing, cleaning and furniture',     'maintenance@campus.edu'),
 ('Accounts Office',       'Accounts',    'Fees, scholarships, refunds and receipts',        'accounts@campus.edu'),
 ('Safety & Security',     'Safety',      'Campus security, fire safety and harassment cases','security@campus.edu'),
 ('Central Library',       'Library',     'Books, digital library and reading rooms',        'library@campus.edu');
