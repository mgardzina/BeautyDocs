"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function main() {
    try {
        const users = await prisma.user.count();
        console.log(`Users count: ${users}`);
    } catch (e) {
        console.log("No users table or connection failed", e.message);
    }
}
main().finally(() => prisma.$disconnect());
