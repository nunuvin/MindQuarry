import { db } from "@/lib/db";

// Mock kysely db simple check
jest.mock("@/lib/db", () => ({
  db: {
    selectFrom: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnValue({
          executeTakeFirst: jest.fn().mockResolvedValue({ id: '1', username: 'testuser' })
        })
      })
    })
  }
}));

describe("Database Mock", () => {
  it("should mock the database correctly", async () => {
    const user = await db.selectFrom("user").select(["id", "username"]).where("id", "=", "1").executeTakeFirst();
    expect(user).toEqual({ id: '1', username: 'testuser' });
  });
});
