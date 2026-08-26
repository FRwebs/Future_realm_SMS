import { Injectable } from "@nestjs/common";
import { randomUUID } from "crypto";
import { z } from "zod";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { prisma } from "../../../../src/lib/db/prisma";

const createArticleSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters."),
  category: z.string().min(2, "Category is required."),
  body: z.string().min(10, "Article body must be at least 10 characters."),
  roleTarget: z.string().trim().optional(),
  videoUrl: z.string().trim().url().optional().or(z.literal("")),
  status: z.enum(["DRAFT", "PUBLISHED"]).default("PUBLISHED")
});

function slugify(title: string) {
  const base = title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  return `${base || "article"}-${randomUUID().slice(0, 8)}`;
}

@Injectable()
export class KnowledgeBaseService {
  private response<T>(data: T, message = "Request completed") {
    return { ok: true, success: true, message, data };
  }

  async listArticles() {
    const articles = await prisma.knowledgeBaseArticle.findMany({
      orderBy: { updatedAt: "desc" },
      include: { author: { select: { firstName: true, lastName: true } } }
    });

    return this.response(
      articles.map((article) => ({
        id: article.id,
        title: article.title,
        slug: article.slug,
        category: article.category,
        roleTarget: article.roleTarget,
        status: article.status,
        views: article.views,
        helpfulYes: article.helpfulYes,
        helpfulNo: article.helpfulNo,
        author: article.author ? `${article.author.firstName} ${article.author.lastName}` : "Unknown",
        updatedAt: article.updatedAt.toISOString(),
        publishedAt: article.publishedAt?.toISOString() ?? null
      })),
      "Knowledge base articles loaded"
    );
  }

  async createArticle(session: SessionPayload, payload: unknown) {
    const parsed = createArticleSchema.parse(payload);
    const author = await prisma.user.findFirst({
      where: { OR: [{ id: session.userId }, { email: session.email }] },
      select: { id: true }
    });

    const article = await prisma.knowledgeBaseArticle.create({
      data: {
        title: parsed.title,
        slug: slugify(parsed.title),
        category: parsed.category,
        body: parsed.body,
        roleTarget: parsed.roleTarget || null,
        videoUrl: parsed.videoUrl || null,
        status: parsed.status,
        authorId: author?.id,
        publishedAt: parsed.status === "PUBLISHED" ? new Date() : null
      }
    });

    return this.response({ id: article.id, slug: article.slug }, "Knowledge base article created");
  }
}
