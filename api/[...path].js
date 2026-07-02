// Vercel serverless-funktion: kor hela Express-appen. Fangar alla /api/*-rutter.
import app from '../server/app.js'

export default app

export const config = {
  maxDuration: 60,
}
