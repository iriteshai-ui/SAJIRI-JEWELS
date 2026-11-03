import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import dashboardRouter from "./dashboard";
import productsRouter from "./products";
import inventoryRouter from "./inventory";
import ordersRouter from "./orders";
import usersRouter from "./users";
import metalRatesRouter from "./metalRates";
import categoriesRouter from "./categories";
import importerRouter from "./importer";
import catalogueRouter from "./catalogue";
import catalogueAuditRouter from "./catalogueAudit";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(dashboardRouter);
router.use(productsRouter);
router.use(inventoryRouter);
router.use(ordersRouter);
router.use(usersRouter);
router.use(metalRatesRouter);
router.use(categoriesRouter);
router.use(importerRouter);
router.use(catalogueRouter);
router.use(catalogueAuditRouter);

export default router;
