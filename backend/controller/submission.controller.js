import { prisma } from "../prisma/prisma.js";
import { client } from "../redis/redis-connection.js";

export const addSubmission = async (req, res) => {
  try {
    const { username, language_id, stdin, source_code } = req.body;
    console.log(req.body);

    if (!username || !source_code) {
      return res
          .status(400)
          .json({ status: "error", error: "All Fields Required" });
    }

    const submission = await prisma.submission.create({
      data: {
        username,
        language_id,
        stdin,
        source_code,
      },
    });

    if (!submission) {
      return res
          .status(400)
          .json({ status: "error", error: "Something went wrong!" });
    }

    res.status(201).json({
      status: "success",
      message: "Submitted Successfully!",
      data: submission,
    });
  } catch (error) {
    res.status(500).json({ status: "error", error: error.message });
  }
};

// Get all submissions
export const getAllSubmissions = async (req, res) => {
  const { page = 1 } = req.query;
  const perPage = 10;
  const skip = (page - 1) * perPage;

  try {
    const cacheKey = `page:${page}`;
    const cacheValue = await client.get(cacheKey);

    if (cacheValue) {
      console.log(`Cache hit for page: ${page}`);
      return res.status(200).json(JSON.parse(cacheValue));
    }

    console.log("Reading from database");
    const submissions = await prisma.submission.findMany({
      take: perPage,
      skip,
      orderBy: { timestamp: "desc" },
    });

    const totalSubmissions = await prisma.submission.count();

    const response = {
      status: "success",
      count: totalSubmissions,
      data: submissions,
    };

    await client.set(cacheKey, JSON.stringify(response));
    await client.expire(cacheKey, 30);

    res.status(200).json(response);

    // Cache the next page
    const nextPage = parseInt(page) + 1;
    const nextPageSkip = (nextPage - 1) * perPage;
    const nextPageSubmissions = await prisma.submission.findMany({
      take: perPage,
      skip: nextPageSkip,
      orderBy: { timestamp: "desc" },
    });

    if (nextPageSubmissions.length > 0) {
      const nextPageCacheKey = `page:${nextPage}`;
      const nextPageResponse = {
        status: "success",
        count: totalSubmissions,
        data: nextPageSubmissions,
      };
      await client.set(nextPageCacheKey, JSON.stringify(nextPageResponse));
      await client.expire(nextPageCacheKey, 30);
    }
  } catch (error) {
    console.log(error);
    res.status(500).json({ status: "error", error: error.message });
  }
};
