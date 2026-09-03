import { generateApiKey, listApiKeys } from "../src/services/auth.service";
import { prisma } from "../src/lib/prisma";

async function main() {
  const args = process.argv.slice(2);
  const nameArg = args.find((a) => a.startsWith("--name="))?.split("=")[1] || "Default Developer Key";
  const scopeArg = args.find((a) => a.startsWith("--scopes="))?.split("=")[1];
  const listFlag = args.includes("--list");

  if (listFlag) {
    const keys = await listApiKeys();
    console.log("\n==========================================");
    console.log("REGISTERED API KEYS");
    console.log("==========================================");
    if (keys.length === 0) {
      console.log("No API keys found.");
    } else {
      keys.forEach((k) => {
        const status = k.revokedAt ? "REVOKED" : k.expiresAt && k.expiresAt < new Date() ? "EXPIRED" : "ACTIVE";
        console.log(`- ID: ${k.id}`);
        console.log(`  Name: ${k.name}`);
        console.log(`  Prefix: ${k.prefix}...${k.last4}`);
        console.log(`  Scopes: ${k.scopes.join(", ")}`);
        console.log(`  Status: ${status}`);
        console.log(`  Created: ${k.createdAt.toISOString()}\n`);
      });
    }
    return;
  }

  const scopes = scopeArg ? scopeArg.split(",") : ["read", "write", "admin"];
  const result = await generateApiKey({
    name: nameArg,
    scopes,
  });

  console.log("\n==========================================");
  console.log("NEW API KEY GENERATED SUCCESSFULLY");
  console.log("==========================================");
  console.log(`Name:   ${result.apiKey.name}`);
  console.log(`Scopes: ${result.apiKey.scopes.join(", ")}`);
  console.log(`Key ID: ${result.apiKey.id}`);
  console.log("\n------------------------------------------");
  console.log("RAW API KEY (Copy now - will not be shown again):");
  console.log(`\n  ${result.rawKey}\n`);
  console.log("------------------------------------------");
  console.log("Usage:");
  console.log(`  curl -H "Authorization: Bearer ${result.rawKey}" http://localhost:3000/api/projects`);
  console.log("==========================================\n");
}

main()
  .then(() => prisma.$disconnect())
  .catch((err) => {
    console.error("Error generating API key:", err);
    prisma.$disconnect();
    process.exit(1);
  });
