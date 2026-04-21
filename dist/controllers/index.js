import express, { Router } from 'express';
const app = express();
const port = 3000;
// Placeholder for authentication middleware import
// import { authMiddleware } from '../auth/auth0';
const router = Router();
// Example health check route
router.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok' });
});
// TODO: Add party, invitation, and assignment routes here
app.use('/api', router);
app.listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(`Server is running on http://localhost:${port}`);
});
export default router;
//# sourceMappingURL=index.js.map