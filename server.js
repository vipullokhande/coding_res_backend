const express = require("express");
const axios = require("axios");
const cors = require("cors");

const app = express();
app.use(cors());

const PORT = process.env.PORT || 3000;

// CODEFORCES CONTESTS
async function getCodeforcesContests() {
    const res = await axios.get("https://codeforces.com/api/contest.list");

    return res.data.result
        .filter(c => c.phase === "BEFORE")
        .map(c => ({
            platform: "Codeforces",
            name: c.name,
            startTime: c.startTimeSeconds,
            duration: c.durationSeconds
        }))
        .slice(0, 5);
}

// LEETCODE CONTESTS
async function getLeetcodeContests() {
    const res = await axios.get("https://kontests.net/api/v1/leet_code");

    return res.data.map(c => ({
        platform: "LeetCode",
        name: c.name,
        startTime: new Date(c.start_time).getTime() / 1000,
        duration: 7200
    }));
}

// HACKERRANK CONTESTS
async function getHackerRankContests() {
    const res = await axios.get("https://kontests.net/api/v1/hacker_rank");

    return res.data.map(c => ({
        platform: "HackerRank",
        name: c.name,
        startTime: new Date(c.start_time).getTime() / 1000,
        duration: 7200
    }));
}

// MAIN API
app.get("/contests", async (req, res) => {
    try {
        const [codeforces, leetcode, hackerrank] = await Promise.all([
            getCodeforcesContests().catch(e => {
                console.error("Codeforces API failed:", e.message);
                return [];
            }),
            getLeetcodeContests().catch(e => {
                console.error("LeetCode API failed:", e.message);
                return [];
            }),
            getHackerRankContests().catch(e => {
                console.error("HackerRank API failed:", e.message);
                return [];
            }),
        ]);


        const allContests = [...codeforces, ...leetcode, ...hackerrank];

        res.json(allContests);

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to fetch contests" });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});