-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ORG', 'ADMIN');

-- AlterTable
ALTER TABLE "orgs" ADD COLUMN     "role" "Role" NOT NULL DEFAULT 'ORG';
