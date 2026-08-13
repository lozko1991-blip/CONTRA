import * as THREE from 'three';
import { teamColor } from '../net/teams.js';

function box(w, h, d) {
  return new THREE.BoxGeometry(w, h, d);
}

function mesh(geo, mat, px, py, pz) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(px, py, pz);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

export function createSoldierMesh(team = 'CT') {
  const isCT = team === 'CT';
  const root = new THREE.Group();

  const teamCol = teamColor(team);
  const vestCol = isCT ? 0x1e2d4a : 0x4a3520;
  const helmCol = isCT ? 0x1a2a3a : 0x3a2a1a;
  const skinCol = 0xd4a870;
  const gearCol = isCT ? 0x2a3d5a : 0x5a3d2a;
  const bootCol = 0x171717;

  const bodyM = new THREE.MeshStandardMaterial({ color: teamCol, roughness: 0.75 });
  const vestM = new THREE.MeshStandardMaterial({ color: vestCol, roughness: 0.82 });
  const helmM = new THREE.MeshStandardMaterial({ color: helmCol, roughness: 0.55, metalness: 0.12 });
  const skinM = new THREE.MeshStandardMaterial({ color: skinCol, roughness: 0.62 });
  const gearM = new THREE.MeshStandardMaterial({ color: gearCol, roughness: 0.78 });
  const bootM = new THREE.MeshStandardMaterial({ color: bootCol, roughness: 0.88 });

  const CHEST_W = 0.36, CHEST_H = 0.28, CHEST_D = 0.24;
  const WAIST_W = 0.28, WAIST_H = 0.14, WAIST_D = 0.2;
  const HIPS_W = 0.30, HIPS_H = 0.12, HIPS_D = 0.22;
  const HEAD_W = 0.24, HEAD_H = 0.26, HEAD_D = 0.26;
  const NECK_W = 0.10, NECK_H = 0.08, NECK_D = 0.10;
  const UARM_W = 0.10, UARM_H = 0.26, UARM_D = 0.10;
  const FARM_W = 0.08, FARM_H = 0.22, FARM_D = 0.08;
  const HAND_W = 0.08, HAND_H = 0.12, HAND_D = 0.08;
  const THIGH_W = 0.14, THIGH_H = 0.3, THIGH_D = 0.16;
  const CALF_W = 0.12, CALF_H = 0.28, CALF_D = 0.14;
  const BOOT_W = 0.16, BOOT_H = 0.08, BOOT_D = 0.26;

  const yHips    = 0.06;
  const yWaist   = yHips + HIPS_H;
  const yChest   = yWaist + WAIST_H;
  const yNeck    = yChest + CHEST_H;
  const yHead    = yNeck + NECK_H;
  const yHelm    = yHead + HEAD_H * 0.5;
  const shoulderX = CHEST_W * 0.5 + 0.02;
  const shoulderY = yChest + CHEST_H * 0.65;
  const hipX      = HIPS_W * 0.45;
  const hipY      = yHips + HIPS_H * 0.2;

  const partials = {};

  // ---- Torso ----
  root.add(mesh(box(CHEST_W, CHEST_H, CHEST_D), bodyM, 0, yChest + CHEST_H * 0.5, 0));
  root.add(mesh(box(WAIST_W, WAIST_H, WAIST_D), bodyM, 0, yWaist + WAIST_H * 0.5, 0));
  root.add(mesh(box(HIPS_W, HIPS_H, HIPS_D), bodyM, 0, yHips + HIPS_H * 0.5, 0));

  // ---- Vest & gear ----
  root.add(mesh(box(CHEST_W + 0.08, CHEST_H * 0.9, CHEST_D + 0.04), vestM, 0, yChest + CHEST_H * 0.55, 0));
  root.add(mesh(box(CHEST_W * 0.6, 0.10, CHEST_D + 0.06), gearM, 0, yChest + CHEST_H * 0.82, 0.02));

  // ---- Neck + Head ----
  root.add(mesh(box(NECK_W, NECK_H, NECK_D), skinM, 0, yNeck + NECK_H * 0.5, 0));
  const headGrp = new THREE.Group();
  headGrp.position.set(0, yHead + HEAD_H * 0.5, 0);
  headGrp.add(mesh(box(HEAD_W, HEAD_H, HEAD_D), skinM, 0, 0, 0));
  partials.head = headGrp;
  root.add(headGrp);

  // ---- Helmet (CT) / Mask (T) ----
  if (isCT) {
    root.add(mesh(box(HEAD_W + 0.06, 0.14, HEAD_D + 0.06), helmM, 0, yHelm, 0));
    root.add(mesh(box(HEAD_W + 0.02, 0.06, 0.04), helmM, 0, yHead + HEAD_H * 0.4, HEAD_D * 0.5));
  } else {
    root.add(mesh(box(HEAD_W + 0.06, HEAD_H * 0.45, HEAD_D + 0.04), gearM, 0, yHead + HEAD_H * 0.65, 0));
    root.add(mesh(box(HEAD_W * 0.9, 0.08, 0.04), skinM, 0, yHead + HEAD_H * 0.35, HEAD_D * 0.52));
  }

  // ---- Arms with pivots ----
  function buildArm(side) {
    const sx = side * shoulderX;
    const pivot = new THREE.Group();
    pivot.position.set(sx, shoulderY, 0);
    pivot.add(mesh(box(UARM_W, UARM_H, UARM_D), bodyM, 0, -UARM_H * 0.5, 0));

    const elbow = new THREE.Group();
    elbow.position.y = -UARM_H;
    elbow.add(mesh(box(FARM_W, FARM_H, FARM_D), bodyM, 0, -FARM_H * 0.5, 0));
    elbow.add(mesh(box(HAND_W, HAND_H, HAND_D), skinM, 0, -FARM_H - HAND_H * 0.5, 0.02));
    pivot.add(elbow);
    return { pivot, elbow };
  }

  const armL = buildArm(-1);
  const armR = buildArm(1);
  root.add(armL.pivot); root.add(armR.pivot);

  // ---- Legs with pivots ----
  function buildLeg(side) {
    const sx = side * hipX;
    const pivot = new THREE.Group();
    pivot.position.set(sx, hipY, 0);
    pivot.add(mesh(box(THIGH_W, THIGH_H, THIGH_D), bodyM, 0, -THIGH_H * 0.5, 0));

    const knee = new THREE.Group();
    knee.position.y = -THIGH_H;
    knee.add(mesh(box(CALF_W, CALF_H, CALF_D), bodyM, 0, -CALF_H * 0.5, 0));
    knee.add(mesh(box(BOOT_W, BOOT_H, BOOT_D), bootM, 0, -CALF_H - BOOT_H * 0.5, 0.04));
    pivot.add(knee);
    return { pivot, knee };
  }

  const legL = buildLeg(-1);
  const legR = buildLeg(1);
  root.add(legL.pivot); root.add(legR.pivot);

  // ---- Weapon (AK shape) ----
  const wG = new THREE.Group();
  const wDark = new THREE.MeshStandardMaterial({ color: 0x1e1e1e, roughness: 0.4, metalness: 0.3 });
  const wMetal = new THREE.MeshStandardMaterial({ color: 0x3a3a3a, roughness: 0.25, metalness: 0.55 });
  wG.add(mesh(box(0.05, 0.08, 0.62), wDark, 0, 0, 0));
  wG.add(mesh(box(0.035, 0.035, 0.42), wMetal, 0, 0.015, -0.42));
  wG.add(mesh(box(0.04, 0.16, 0.06), wDark, 0, -0.12, 0.04));
  wG.add(mesh(box(0.04, 0.10, 0.20), wDark, 0, -0.015, 0.36));
  wG.add(mesh(box(0.04, 0.12, 0.05), wDark, 0, -0.10, 0.08));
  wG.position.set(0.38, shoulderY - 0.04, -0.18);
  wG.rotation.x = -0.06;
  root.add(wG);

  // ---- Walking animation data ----
  root.userData.anim = {
    armLPivot: armL.pivot, armRPivot: armR.pivot,
    armLElbow: armL.elbow, armRElbow: armR.elbow,
    legLPivot: legL.pivot, legRPivot: legR.pivot,
    legLKnee: legL.knee, legRKnee: legR.knee
  };
  root.userData.materials = { bodyMat: bodyM };
  root.userData.walkPhase = 0;

  /**
   * Реальний зріст людини ~1.8м.
   * Всі координати моделі в локальній системі (від стоп, y=0),
   * тому масштабуємо групу, щоб голова була на рівні ~1.65.
   */
  root.scale.setScalar(1.8);

  return root;
}

export function animateSoldierWalk(mesh, dt, speed = 0) {
  const a = mesh?.userData?.anim;
  if (!a) return;

  if (speed < 0.1) {
    a.armLPivot.rotation.x = 0; a.armRPivot.rotation.x = 0;
    a.armLElbow.rotation.x = 0; a.armRElbow.rotation.x = 0;
    a.legLPivot.rotation.x = 0; a.legRPivot.rotation.x = 0;
    a.legLKnee.rotation.x = 0; a.legRKnee.rotation.x = 0;
    return;
  }

  mesh.userData.walkPhase += dt * speed * 2.8;
  const ph = mesh.userData.walkPhase;
  const sw = Math.sin(ph) * Math.min(speed * 0.12, 0.5);

  a.legLPivot.rotation.x = sw;
  a.legRPivot.rotation.x = -sw;
  a.armLPivot.rotation.x = -sw * 0.6;
  a.armRPivot.rotation.x = sw * 0.6;

  const knee = Math.abs(Math.cos(ph)) * 0.5;
  a.legLKnee.rotation.x = knee;
  a.legRKnee.rotation.x = knee;
  const elbow = Math.abs(Math.cos(ph)) * 0.3;
  a.armLElbow.rotation.x = elbow;
  a.armRElbow.rotation.x = elbow;
}