import { Router } from "express";
import { featureController } from "./feature.controller";

const router = Router();

router.post("/", featureController.create);
router.get("/", featureController.listAll);
router.get('/types', featureController.getTypes);
router.get("/:id", featureController.getById);
router.patch("/:id", featureController.update);
router.patch("/:id/status", featureController.updateStatus);
router.delete("/:id", featureController.delete);

export default router;
