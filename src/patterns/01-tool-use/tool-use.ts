/**
 * PATRÓN: Uso de herramientas - Tool use
 * ---------------------------
 * El catálogo de cursos NO está en el entrenamiento
 * del modelo. Sin herramientas, el modelo inventa precios y cursos con
 * total confianza o en su defecto, no hace nada.
 * Con herramientas, consulta el dato real.
 */

import { generateText, tool, stepCountIs } from "ai";
import { z } from "zod";
import { createTracer, model } from "../../helpers/index.js";

// ---------------------------------------------------------------------------
//  LA "BASE DE DATOS" — datos que el modelo no puede conocer
// ---------------------------------------------------------------------------

type Course = {
  id: string;
  title: string;
  hours: number;
  priceUSD: number;
  level: "basic" | "intermediate" | "advanced";
  students: number;
};

const COURSE_CATALOG: Course[] = [
  {
    id: "ts-01",
    title: "TypeScript desde cero",
    hours: 22,
    priceUSD: 19.99,
    level: "basic",
    students: 48_120,
  },
  {
    id: "nest-02",
    title: "NestJS: API REST modular",
    hours: 31,
    priceUSD: 24.99,
    level: "intermediate",
    students: 22_450,
  },
  {
    id: "flu-03",
    title: "Flutter: apps multiplataforma",
    hours: 46,
    priceUSD: 29.99,
    level: "intermediate",
    students: 61_300,
  },
  {
    id: "agt-04",
    title: "Agentes de IA con TypeScript",
    hours: 18,
    priceUSD: 34.99,
    level: "advanced",
    students: 1_890,
  },
  {
    id: "dkr-05",
    title: "Docker para desarrolladores",
    hours: 14,
    priceUSD: 17.99,
    level: "basic",
    students: 35_770,
  },
];
const QUESTION =
  "Cuánto costariían juntos el curso de TypeScript y el de Dcoker con un 20% de descuento? Dame tambíen las horas totales";

async function withoutTools() {
  const tracer = createTracer("Sin herramientas");

  const { text } = await generateText({
    model,
    prompt: QUESTION,
    onStepEnd: tracer.onStepFinish,
  });

  console.log("\n Respuesta: ", text.green);
  console.log("\n Verificar los números contra el catalogo de cursos: ");

  return tracer.summary();
}

// ====== IMplementar el Patrón Tool Use

// Tool #1 Find courses

const findCourseTool = tool({
  description:
    "Busca cursos en el catálogo de detalles, por texto " +
    "en el título o por nivel. Utilizala siempre antes de responder " +
    "cualquier pregunta sobre cursos, precios , cantidad de alumnos",
  inputSchema: z.object({
    text: z
      .string()
      .optional()
      .describe("Texto a buscar en el título del curso."),
    level: z.enum(["basic", "intermediate", "advanced"]).optional(),
  }),
  execute: async ({ text, level }) => {
    const filteredCourses = COURSE_CATALOG.filter((course) => {
      const matchestText =
        !text ||
        course.title.toLocaleLowerCase().includes(text.toLocaleLowerCase());

      const matchesLevel = !level || course.level === level;

      return matchestText && matchesLevel;
    });

    return {
      found: filteredCourses.length,
      courses: filteredCourses,
    };
  },
});

const calculateTotal = tool({
  description:
    "Calcula el precio total de una lista de cursos aplicando un descuento porcentual. Utilízala siempre para cualquier operación aritmética. No calcules mentalmente.",
  inputSchema: z.object({
    ids: z
      .array(z.string())
      .describe("Ids de los cursos. ej: ['ts-01', 'dkr-053']"),
    discountPercent: z.number().min(0).max(100).default(0),
  }),
  execute: async ({ ids, discountPercent }) => {
    const foundCourses = COURSE_CATALOG.filter((course) =>
      ids.includes(course.id),
    );

    const notFound = ids.filter(
      (id) => !COURSE_CATALOG.some((course) => course.id === id),
    );

    const subtotal = foundCourses.reduce(
      (acc, course) => acc + course.priceUSD,
      0,
    );

    const discount = subtotal * (discountPercent / 100);

    return {
      subtotal: Number(subtotal.toFixed(2)),
      discount: Number(discount.toFixed(2)),
      total: Number((subtotal - discount).toFixed(2)),
      notFound: notFound,
    };
  },
});

async function withTools() {
  const tracer = createTracer("con-herramientas");

  const { text } = await generateText({
    model,
    prompt: QUESTION,
    tools: { findCourseTool, calculateTotal },

    // Circuit Breaker
    stopWhen: stepCountIs(6),
    instructions:
      "Eres un asistente del catálogo de cursos de devtalles " +
      "No inventes precios, duraciones ni nombres de cursos. " +
      "Consúltalos siempre con las herramientas disponibles. ",
    onStepEnd: tracer.onStepFinish,
  });

  console.log("\n Respuesta: ", text.green);
  console.log("\n ⚠️ Verificar los números contra el catalogo de cursos");

  return tracer.summary();
}

export async function toolUseMain() {
  // const resultA = await withoutTools();
  const resultB = await withTools();

  // console.log("\n==== Comparativa ====");
  // console.table({ "Sin herramientas:": resultA });

  console.log("\n==== Comparativa ====");
  console.table({
    // "Sin herramientas: ": resultA,
    "Con herramientas: ": resultB,
  });
}
