import { createTRPCProxyClient, httpBatchLink } from '@trpc/client'
import type { AppRouter } from '../../etl/src/server'
import { Env } from 'lazy-strict-env'
import { z } from 'zod'

const apiEnv = Env(
  z.object({
    BKKCHANGELOG_API_URL: z
      .string()
      .url()
      .default('https://bkkchangelog.azurewebsites.net/api'),
  }),
)

export const client = createTRPCProxyClient<AppRouter>({
  links: [
    httpBatchLink({
      url: apiEnv.BKKCHANGELOG_API_URL,
    }),
  ],
})
