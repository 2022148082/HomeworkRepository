// index.js
const express = require("express");
const path = require("path");
const sqlite3 = require("sqlite3").verbose();
const fs = require("fs");

const app = express();
const db = new sqlite3.Database(path.join(__dirname, "product.db"));
const COMMENTS_FILE = path.join(__dirname, "comment.json");

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// --- 페이지 라우팅 ---
app.get("/", (_, res) =>
  res.sendFile(path.join(__dirname, "public/index.html"))
);
app.get("/login", (_, res) =>
  res.sendFile(path.join(__dirname, "public/login.html"))
);
app.get("/signup", (_, res) =>
  res.sendFile(path.join(__dirname, "public/signup.html"))
);
app.get("/movies/:id", (_, res) =>
  res.sendFile(path.join(__dirname, "public/detail.html"))
);

// --- API: 영화 리스트 조회 & 검색/정렬/페이징 (무한 스크롤) ---
app.get("/api/movies", (req, res) => {
  const q = req.query.q || ""; // 키워드
  const sort = req.query.sort || "rating_desc"; // sort 타입(rating_desc, rating_asc, date_desc, date_asc)
  const offset = parseInt(req.query.offset) || 0; // 다음 로딩 시작 인덱스
  const limit = parseInt(req.query.limit) || 6; // 한 번에 불러올 개수

  // 기본 SELECT 문, 컬럼명은 클라이언트 스크립트가 기대하는 이름으로 alias 처리
  let sql = `
    SELECT
      movie_id,
      movie_image   AS poster_path,
      movie_title   AS title,
      movie_overview AS overview,
      movie_release_date AS release_date,
      movie_rate    AS rating
    FROM movie
  `;
  const params = [];

  // 키워드 WHERE
  if (q) {
    sql += ` WHERE movie_title LIKE ?`;
    params.push(`%${q}%`);
  }

  // 정렬 ORDER BY
  switch (sort) {
    case "rating_asc":
      sql += ` ORDER BY movie_rate ASC`;
      break;
    case "date_desc":
      sql += ` ORDER BY movie_release_date DESC`;
      break;
    case "date_asc":
      sql += ` ORDER BY movie_release_date ASC`;
      break;
    case "rating_desc":
    default:
      sql += ` ORDER BY movie_rate DESC`;
      break;
  }

  // 페이징
  sql += ` LIMIT ? OFFSET ?`;
  params.push(limit, offset);

  db.all(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// --- API: 단일 영화 상세정보 ---
app.get("/api/movies/:id", (req, res) => {
  db.get(
    `
      SELECT
        movie_id,
        movie_image   AS poster_path,
        movie_title   AS title,
        movie_overview AS overview,
        movie_release_date AS release_date,
        movie_rate    AS rating
      FROM movie
      WHERE movie_id = ?
    `,
    [req.params.id],
    (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!row) return res.status(404).json({ error: "Not found" });
      res.json(row);
    }
  );
});

// --- API: 댓글 조회 & 작성 ---
app.get("/api/movies/:id/comments", (req, res) => {
  const all = JSON.parse(fs.readFileSync(COMMENTS_FILE, "utf8"));
  res.json(all[req.params.id] || []);
});

app.post("/api/movies/:id/comments", (req, res) => {
  const { author, rating, text } = req.body;
  const all = JSON.parse(fs.readFileSync(COMMENTS_FILE, "utf8"));
  const list = all[req.params.id] || [];

  const newC = { author, rating, text, date: new Date().toISOString() };
  list.push(newC);
  all[req.params.id] = list;

  fs.writeFileSync(COMMENTS_FILE, JSON.stringify(all, null, 2), "utf8");
  res.status(201).json(newC);
});

// 서버 시작
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
