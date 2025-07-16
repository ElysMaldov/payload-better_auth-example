import * as schema from '@/payload-generated-schema'
import { drizzle } from '@payloadcms/db-postgres/drizzle/node-postgres'
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'

/* Payload re-exports drizzle package */
const db = drizzle(process.env.DATABASE_URI as string)

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema,
    usePlural: false, // Should be false when having custom table name mapping as outlined below
  }),
  advanced: {
    generateId: false, // Should be false since we'll let Payload generate the ids
  },
  emailAndPassword: {
    enabled: true,
  },

  /* 
  If needed, you can map the core schemas to the drizzle schema table names. When doing this, make sure to 
  set usePlural to false to avoid errors like users table being searched as userss. You only ever need to
  manually map when you use a different slug for the 4 core collections. For example your Users collections slug
  is students, so you should set the user modelName to students.
  */
  user: {
    modelName: 'users',
  },
  account: {
    modelName: 'user_accounts',
    accountLinking: {
      allowDifferentEmails: true,
      enabled: true,
    },
  },
  verification: {
    modelName: 'user_verifications',
  },
  session: {
    modelName: 'user_sessions',
  },

  /* Go ahead and adjust your Better Auth as needed like adding social providers */
  // socialProviders: {
  //   google: {
  //     clientId: process.env.GOOGLE_PROVIDER_CLIENT_ID,
  //     clientSecret: process.env.GOOGLE_PROVIDER_CLIENT_SECRET,
  //   },
  // },

  /* And even plugins works too */
  // plugins: []
})
