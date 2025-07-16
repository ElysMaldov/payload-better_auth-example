# Payload x Better Auth Example

This repository showcases how to manually integrate Payload with Better Auth using PostgreSQL.

****Table of Contents****

- [Payload x Better Auth Example](#payload-x-better-auth-example)
  - [Running Project](#running-project)
  - [How it Works](#how-it-works)
    - [There will be 2 different database connections](#there-will-be-2-different-database-connections)
    - [Varying and possibly conflicting field types](#varying-and-possibly-conflicting-field-types)
  - [Manual Setup Steps](#manual-setup-steps)
    - [1. Package installation](#1-package-installation)
    - [2. Creating database tables through Payload Collections](#2-creating-database-tables-through-payload-collections)
    - [3. Generating and passing Payload's drizzle schema](#3-generating-and-passing-payloads-drizzle-schema)
    - [4. Setting up custom strategy for User collection 🔑](#4-setting-up-custom-strategy-for-user-collection-)
    - [5. Adding logout endpoint](#5-adding-logout-endpoint)
    - [6. Finishing Better Auth setup](#6-finishing-better-auth-setup)
    - [7. Re-creating the auth UIs ⚠️](#7-re-creating-the-auth-uis-️)
    - [8. Results](#8-results)
    - [9. Maintenance step](#9-maintenance-step)
    - [10. Other things you can do](#10-other-things-you-can-do)
  - [Why and when to use Better Auth with Payload?](#why-and-when-to-use-better-auth-with-payload)

## Running Project

1. Make sure to enable Docker
2. Install dependencies with `pnpm install`
3. Start the project with `pnpm dev`
4. This will run a `predev` script that spins up a PostgreSQL database using Docker Compose.
   If you want to run your own PostgreSQL, remove the `predev` script from `package.json` and run the database manually.
   Then update the `DATABASE_URI` in `.env.development`.

## How it Works

One approach of integrating Better Auth with Payload is to make a [custom database adapter for Better Auth](https://www.better-auth.com/docs/guides/create-a-db-adapter). Another option is using [Payload Auth plugin](https://github.com/payload-auth/payload-auth). But another way is using existing adapters, such as the [Drizzle adapter for Better Auth](https://www.better-auth.com/docs/adapters/drizzle); which so happens Payload CMS also uses drizzle when you are using PostgreSQL as your database.

Better Auth and its plugins asks you to migrate your database schema to add some fields necessary for them to work. The important thing about this is that you are able to setup your database manually by following the schemas provided in Better Auth documentation and using any methods to migrate your database (e.g. manually or using ORMs). A lot of the data types required by Better Auth schema can be mapped to Payload's fields. Other than that, Better Auth allows you to map different names for its table and fields. So, we could potentially use Payload CMS to manage Better Auth's database schema while still leveraging Payload features such as the Admin UI.

The integration works by leveraging Payload's functionality to generate its drizzle schema using the `npx payload generate:db-schema` command. This generates the drizzle schema file in `payload-generated-schema.ts` which we are able to pass to Better Auth's drizzle adapter. This way, Better Auth will consume your Payload's database schema, while Payload will manage the schemas required by Better Auth.

Some caveats of this approach:

### There will be 2 different database connections

   Now I'm not certain about this, but Better Auth and Payload will have their own database "connections". This approach won't make Better Auth use Payload, but Better Auth will use its own APIs to query and update the database besides Payload CMS. The common denominator is the database schema, which will be the same for both. But each of them will have their own way using the database, but I'm not sure if this actually results in 2 different database connections.

   This also means that Payload CMS access controls and hooks wont work when Better Auth is accessing the database, e.g. when you CRUD a user using Better Auth instance it won't trigger any hooks defined in your Users collection.

### Varying and possibly conflicting field types

   Most of the time the types provided by Payload fields and Better Auth schema aligns. For example, the [core User schema](https://www.better-auth.com/docs/concepts/database#user) required by Better Auth asks for name and email as string, which we can just make a text field with the same names in Payload; or the emailVerified asks for boolean which we can just make an emailVerified checkbox field in Payload in the User collection.

   The cool thing about this is that we could actually use Payload's relationship fields in some places.AFAIK when you have a relationship field from document A to document B; document A will store document B id as a string in the database. This means for any place Better Auth asks you for a field of type string, you could just use a relationship field in Payload.

   For example both Better Auth [Session](https://www.better-auth.com/docs/concepts/database#user) and [Account](https://www.better-auth.com/docs/concepts/database#user) core schemas asks for a `userId` which is a foregin key to the User schema. Even though the docs tells you it should be type string, you are able to just make a `userId` relationship field in your Payload's Session and Account collections that relates to the User collection. This allows you to still use Payload's relationship features like populating and a better Admin UI experience.

   But, I faced an edge case with Date types; specifically when using Better Auth's [Admin plugin ban user functionality](https://www.better-auth.com/docs/concepts/database#user). Better Auth requires `banExpires` to be a date in the database. Using Payload's date field works at first, but then I faced issues when Better Auth tried to read that field, specifically I got `value.getTime is not a function` error. After some digging, apparently this was caused by Better Auth drizzle adapter expecting `banExpires` to use `mode: "date"` instead of `mode: "string"` which is what all Payload date fields use.

   I tried adjusting the date mode using Payload's `beforeSchemaInit` and it worked, Better Auth was able to read the field correctly. But the new issue is that I'm not able to change that field in the Admin UI, since now Payload throws an error `value.toISOString is not a function`. So in the end I decided to just delete that field, but at least Better Auth ban system still works and I can manually toggle the user's banned status and reason through the admin UI, just without an expiration date.

So if you want, you can use Better Auth's plugins with Payload; since most of the plugins just asks you to migrate your database schema. But there might be weird edge cases like this. This might desuade you from using this approach, but I've used this integration in a production Learning Management System project and never faced any issues in prod. Performance wise I haven't felt it to be slow, but YMMV.

The end result of this approach is that you have Payload and Better Auth working individually as they should. For example, adding Better Auth plugin shouldn't affect how Payload works (unless you mess up the database schema). In return, Payload hooks, access controls, fields, etc. shouldn't affect your Better Auth instance.

They work together explicitly only during the auth step. We setup a [custom auth strategy in Payload](https://payloadcms.com/docs/authentication/custom-strategies) that uses Better Auth to authorizes the incoming headers and return the user data fetched by Payload. Other than that step, they don't explicitly require each other.

## Manual Setup Steps

This repo should work OOTB, but if you want to do things manually, follow the guide below to understand how you could set up Better Auth with your Payload project.

### 1. Package installation

Follow [Better Auth's installation guide from step 1-3](https://www.better-auth.com/docs/installation#install-the-package), then stop at step 4. Step 4 & 5 wants us to connect an adapter and manage the database tables. First, we should create the database tables so we can generate the schema that we can provide to Better Auth drizzle adapter.

### 2. Creating database tables through Payload Collections

As stated before, Better Auth allows us to manually setup our database. So we'll use Payload collections to setup the schema. Better Auth wants 4 core schemas: User, Session, Account, and Verification. We need to make 4 payload collections and name them clearly. We don't have to name them specifically, since Better Auth allows us to map custom table [names and fields](https://www.better-auth.com/docs/concepts/database#custom-tables); but it's nicer to have consistent naming.

This repository provides you examples for those 4 collections in the `src/collections/auth` folder. You can copy-paste them instantly and adjust as needed, then import them into your `payload.config.ts`. Once you run your project, you should get 4 database tables created.

> You must name the field names required by Better Auth exactly as stated in their docs. For example if they ask for `emailVerified` then your Payload field name must also be `emailVerified`. You could later re-map the Better Auth field to any of your Payload field names, but this is way easier.
> Other than the required fields, you can also add additional fields in the Payload collection since Better Auth won't know about those extra fields anyways.

### 3. Generating and passing Payload's drizzle schema

Once you've imported your collections, you need to generate the drizzle schema. Use this command:

```bash
npx payload generate:db-schema
```

Or you can make a package.json script to run `payload generate:db-schema` (check this repo's example).

This will output a `payload-generated-schema.ts`.

Now remember in step 3 Better Auth wants you to create an instance in `auth.ts` file, now we can pass our drizzle adapter to that betterAuth instance. Follow the code in [`src/auth/auth.ts`](src/auth/auth.ts) to understand how we pass in the adapter.

### 4. Setting up custom strategy for User collection 🔑

The is the most imporatnt step to integrating these two tools. Payload allows us to setup [custom auth strategies](https://payloadcms.com/docs/authentication/custom-strategies) that makes us able to integrate different kind of auth systems other than just Better Auth with Payload CMS. We can add custom strategies to any auth-enabled collections in Payload. So if you have 3 auth collections like SuperAdmins, Admins, and Users, you can set different auth strategies with them like SuperAdmins using the default Payload auth, Admins using Clerk, and Users using Better Auth.

When we add custom strategies, we **could** disable Payload's local auth strategy using `disableLocalStrategy` in the auth-enabled collection so that we make sure all of our auth operations goes through our auth libraries. But this comes with a significant cost of also disabling the auth UI from Payload's admin dashboard, that is you can't access the login, create first user, and reset password pages anymore. So not only you have to setup a custom strategy logic, now you also have to setup your UI pages again. Later there will be a step to re-create those UIs again easily.

For now, open [`src/collections/auth/Users.ts`](src/collections/auth/Users.ts) and see the `strategies` field inside of `auth` field in the collection config to see how the custom strategy works.

The gist of how it works is that you can pass in multiple functions to `strategies` where each function receives some args (e.g. headers) and should use those args to authenticate the user; then returning the user data if authenticated or null if not authenticated. This is where Payload will explicitly require Better Auth.

These strategies will run in the order you put them in, and if I'm not mistaken, the final strategy return data will be considered as the user data to be used by Payload. From my testing, these strategies runs during:

- Any request to Payload (either through local APIs or even REST APIs)
- Calling the `payload.auth` method

> NOTE! If you updated your strategy function but not seeing any changes, try to restart your server. I find that the strategies don't update during HMR, only when restarting the server.

### 5. Adding logout endpoint

To allow users to logout even when not using Payload local API, we can add a `/logout` endpoint inside of our Users collection, which should result in `/api/users/logout` or `/api/{your-auth-collection-slug}/logout`.

See the code in [`src/collections/auth/Users.ts`](src/collections/auth/Users.ts) `endpoints` field.

### 6. Finishing Better Auth setup

Once you've setup your Better Auth instance by passing in the generated schema and also setup the custom strategy, you can continue the rest of [Better Auth steps (6 - finish)](https://www.better-auth.com/docs/installation#authentication-methods). This repo also has the code for those steps.

### 7. Re-creating the auth UIs ⚠️

When you disable Payload's local strategy using `disableLocalStrategy`, you will also loose all of the auth UIs from Payload. To re-create them, you can either manually write components for those or we can quickly use [Better Auth UI](https://better-auth-ui.com/) which is a component library that quickly gives us the necessary pages back (e.g. login, register, reset password, verification, etc.). I choose this library since it works seamlessly with Better Auth and the resulting design is modern and customizable enough since it's using Shadcn and Tailwind.

Follow these steps to setup:

1. [Follow the installation guide and choose Next.js (also don't forget to setup the prerequisites like setting up Shadcn)](https://better-auth-ui.com/getting-started/requirements).
2. Move the `/app/auth` folder into `/app/(payload)/admin/auth`. This is because Paylaod will redirect you to `/admin/{auth-path}` when you need to authenticate, for example `/admin/login` or `/admin/`.
3. Now we need to map Payload redirects to what Better Auth requires. Open the `payload.config.ts` file and you'll notice inside the `admin` field in `buildConfig` there is `routes` that maps which page should go to which path. I set it up so that it conforms to what [Better Auth UI requires](https://better-auth-ui.com/integrations/next-js#creating-auth-pages), but since you can change those as well, remember to re-map this field again.
4. Once that's done, if you try to go to the admin dashboard unauthenticated or logging out, you should be redirected to the correct page

> ⚠️⚠️⚠️
>
> One important page that goes missing is the create-first-user page, which only shows up when you are creating your first database user which usually is the admin/superAdmin. This setup redirects first user and any user without an account to the registration page, which means that anybody can register and gain access to your admin dashboard. This is something you have to figure out for yourself.
>
> My approach (which is not documented fully in this repo) is to use RBAC by having a `role` field in the Users collection and using Better Auth admin plugin to check the role permissions in the Users collection `admin` access control. The `admin` access control is used in the auth-enabled Payload collection that is used to gain access to the Admin dashboard and allows us to determine if the user can access the admin dashboard or not ([see docs here](https://payloadcms.com/docs/access-control/collections#admin)). Open the Users collection file for the example code that is commented.
>
> ⚠️⚠️⚠️

### 8. Results

DONE!!! Now, you have both Payload and Better Auth working in your project that works as they should with the added benefit of having Better Auth UI. Later, you can also add Better Auth plugins and it shouldn't affect your Payload instance since Payload only integrates with Better Auth during the auth process.

### 9. Maintenance step

The only maintenance step you need to do is when you change your Payload collection fields that Better Auth also uses (usually when adding or modifying Better Auth plugins), you need to generate the drizzle schema again. This is important since Better Auth communicates with your database using this schema so it should be synced to your Payload's schema.

Side note, you can actually modify the generated schema file manually after generating, but I don't recommend this since this adds manual overhead. Instead, try to use Payload's `beforeSchemaInit` to change the generated schema like [in the docs](https://payloadcms.com/docs/database/postgres#note-for-generated-schema).

### 10. Other things you can do

Since you now have a somewhat normal Better Auth instace, you could add plugins and do:

1. Add social providers
2. Use the admin plugin to add RBAC and banning users or even impersonate them
3. Add login by username
4. Use MongoDB adapter instead of drizzle and PostgreSQL (something I did in my LMS project [Akasia Education](https://akasiaedu.com))
5. Anything else Better Auth can do should be possible in this setup as well without affecting Payload CMS

## Why and when to use Better Auth with Payload?
