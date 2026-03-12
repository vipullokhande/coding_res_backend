const express = require("express");
const axios = require("axios");
const http = require("http");
const https = require("https");
const cors = require("cors");
const cheerio = require('cheerio');
const dayjs = require("dayjs");

const app = express();
app.use(cors());

const PORT = process.env.PORT || 3000;
const axiosInstance = axios.create({
    httpAgent: new http.Agent({ family: 4 }),
    httpsAgent: new https.Agent({ family: 4 }),
});
const headers = {
    "User-Agent": "Mozilla/5.0"
};

function calculateTimeLeft(dateText) {
    if (!dateText) return "Unknown";

    const parsed = dayjs(dateText);

    if (!parsed.isValid()) return "Unknown";

    const diff = parsed.diff(dayjs(), "day");

    if (diff < 0) return "Ended";

    return diff + " days left";
}

/* ---------------- SAFE SCRAPER WRAPPER ---------------- */

async function safeScrape(name, scraper) {
    try {
        const data = await scraper();

        console.log(`✅ ${name} success (${data.length})`);

        return data;

    } catch (err) {

        console.log(`❌ ${name} failed: ${err.message}`);

        return [];
    }
}

/* ---------------- DEVPOST ---------------- */

async function scrapeDevpost() {

    const url = "https://devpost.com/hackathons";

    const res = await axios.get(url, { headers });

    const $ = cheerio.load(res.data);

    const list = [];

    $("a.block-wrapper").each((i, el) => {

        const title = $(el).find("h3").text().trim();
        const link = "https://devpost.com" + $(el).attr("href");
        const image = $(el).find("img").attr("src");
        const date = $(el).find(".submission-period").text().trim();

        if (title) {

            list.push({
                source: "Devpost",
                title,
                date: date || "Unknown",
                location: "Online / Global",
                prize: "Varies",
                timeLeft: calculateTimeLeft(date),
                link,
                image
            });

        }

    });

    return list;
}

/* ---------------- MLH ---------------- */

async function scrapeMLH() {

    const url = "https://mlh.io/seasons/2025/events";

    const res = await axios.get(url, { headers });

    const $ = cheerio.load(res.data);

    const list = [];

    $(".event").each((i, el) => {

        const title = $(el).find(".event-name").text().trim();
        const link = $(el).find("a").attr("href");
        const date = $(el).find(".event-date").text().trim();
        const location = $(el).find(".event-location").text().trim();

        if (title) {

            list.push({
                source: "MLH",
                title,
                date: date || "Unknown",
                location: location || "Unknown",
                prize: "Varies",
                timeLeft: calculateTimeLeft(date),
                link,
                image: ""
            });

        }

    });

    return list;
}

/* ---------------- UNSTOP ---------------- */

async function scrapeUnstop() {

    const url = "https://unstop.com/hackathons";

    const res = await axios.get(url, { headers });

    const $ = cheerio.load(res.data);

    const list = [];

    $("h3").each((i, el) => {

        const title = $(el).text().trim();

        if (title.toLowerCase().includes("hack")) {

            list.push({
                source: "Unstop",
                title,
                date: "Check website",
                location: "Various",
                prize: "Varies",
                timeLeft: "Unknown",
                link: url,
                image: ""
            });

        }

    });

    return list;
}

/* ---------------- EVENTBRITE ---------------- */

async function scrapeEventbrite() {

    const url = "https://www.eventbrite.com/d/online/hackathon/";

    const res = await axios.get(url, { headers });

    const $ = cheerio.load(res.data);

    const list = [];

    $("h3").each((i, el) => {

        const title = $(el).text().trim();

        if (title.toLowerCase().includes("hack")) {

            list.push({
                source: "Eventbrite",
                title,
                date: "Check website",
                location: "Online",
                prize: "Varies",
                timeLeft: "Unknown",
                link: url,
                image: ""
            });

        }

    });

    return list;
}

/* ---------------- API ROUTE ---------------- */

app.get("/hackathons", async (req, res) => {

    try {

        const results = await Promise.all([

            safeScrape("Devpost", scrapeDevpost),

            safeScrape("MLH", scrapeMLH),

            safeScrape("Unstop", scrapeUnstop),

            safeScrape("Eventbrite", scrapeEventbrite)

        ]);

        const allHackathons = results.flat();

        res.json({
            success: true,
            total: allHackathons.length,
            data: allHackathons
        });

    } catch (err) {

        res.status(500).json({
            success: false,
            message: "Unexpected server error",
            error: err.message
        });

    }

});

// Codeforces
async function scrapeCodeforces() {
    try {
        const { data } = await axios.get("https://codeforces.com/contests");
        const $ = cheerio.load(data);

        const contests = [];
        $("#contestList tr").each((i, el) => {
            const name = $(el).find("td:nth-child(1) a").text();
            const timeStr = $(el).find("td:nth-child(2)").text();
            const phase = $(el).find("td:nth-child(3)").text();
            if (phase === "BEFORE") {
                const startTime = new Date(timeStr).getTime() / 1000;
                contests.push({ platform: "Codeforces", name, startTime });
            }
        });

        return contests.slice(0, 5);
    } catch (err) {
        console.error("Codeforces scraper failed:", err.message);
        return [];
    }
}

// HackerRank
async function scrapeHackerRank() {
    try {
        const { data } = await axios.get("https://www.hackerrank.com/contests");
        const $ = cheerio.load(data);

        const contests = [];
        $(".contest-card").each((i, el) => {
            const name = $(el).find(".contest-name").text();
            const timeStr = $(el).find(".contest-date").text();
            const startTime = new Date(timeStr).getTime() / 1000;
            contests.push({ platform: "HackerRank", name, startTime });
        });

        return contests.slice(0, 5);
    } catch (err) {
        console.error("HackerRank scraper failed:", err.message);
        return [];
    }
}

// ------------------ Combine All Scrapers ------------------ //
async function getAllContests() {
    const results = await Promise.all([
        scrapeCodeforces(),
        scrapeHackerRank()
        // Add more scrapers here
    ]);

    const contests = results.flat();
    contests.sort((a, b) => a.startTime - b.startTime); // sort by startTime
    return contests;
}
app.get("/contestsscrape", async (req, res) => {
    try {
        const contests = await getAllContests();
        res.json(contests); // simply return all contests
    } catch (err) {
        console.error("Error in /contests endpoint:", err.message);
        res.status(500).json({ error: "Failed to fetch contests" });
    }
});

// CODEFORCES CONTESTS
async function getCodeforcesContests() {
    const res = await axiosInstance.get("https://codeforces.com/api/contest.list");

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
    const res = await axiosInstance.get("https://kontests.net/api/v1/leet_code");

    return res.data.map(c => ({
        platform: "LeetCode",
        name: c.name,
        startTime: new Date(c.start_time).getTime() / 1000,
        duration: 7200
    }));
}

// HACKERRANK CONTESTS
async function getHackerRankContests() {
    const res = await axiosInstance.get("https://kontests.net/api/v1/hacker_rank");

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