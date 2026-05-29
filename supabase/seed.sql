-- ============================================================
-- Datos de prueba (opcional). Ejecuta DESPUÉS de 0001_init.sql.
-- ============================================================
-- NOTA: los usuarios reales se crean vía Auth (registro en la app),
-- lo que dispara el trigger que llena `profiles`. Por eso aquí solo
-- sembramos ejercicios de PRÁCTICA libre, que no dependen de un usuario.
--
-- Para datos con cursos/tareas: regístrate como profesor en la app,
-- crea un curso y usa la UI (Fase 3) — respeta RLS de forma natural.

insert into exercises (is_practice, title, prompt, starter_code, solution_code, language, difficulty, points, order_index)
values
  (true, 'Hola Mundo',
   'Escribe un programa que muestre por pantalla el texto: Hola Mundo',
   E'Algoritmo HolaMundo\n\t// escribe aquí\nFinAlgoritmo',
   E'Algoritmo HolaMundo\n\tEscribir "Hola Mundo"\nFinAlgoritmo',
   'pseint', 'beginner', 100, 1),

  (true, 'Suma de dos números',
   'Lee dos números enteros e imprime su suma.',
   E'Algoritmo Suma\n\t// escribe aquí\nFinAlgoritmo',
   E'Algoritmo Suma\n\tDefinir a, b Como Entero\n\tLeer a, b\n\tEscribir a + b\nFinAlgoritmo',
   'pseint', 'beginner', 100, 2),

  (true, 'Par o impar',
   'Dado un número entero, indica si es PAR o IMPAR.',
   E'public class Main {\n    public static void main(String[] args) {\n        int n = 7;\n        // escribe aquí\n    }\n}',
   E'public class Main {\n    public static void main(String[] args) {\n        int n = 7;\n        System.out.println(n % 2 == 0 ? "PAR" : "IMPAR");\n    }\n}',
   'java', 'easy', 100, 3),

  (true, 'Tabla de multiplicar',
   'Imprime la tabla de multiplicar del número 5 (del 1 al 10).',
   E'public class Main {\n    public static void main(String[] args) {\n        // escribe aquí\n    }\n}',
   E'public class Main {\n    public static void main(String[] args) {\n        for (int i = 1; i <= 10; i++)\n            System.out.println("5 x " + i + " = " + (5 * i));\n    }\n}',
   'java', 'easy', 100, 4),

  (true, 'Recorrer un arreglo',
   'Recorre un arreglo de 5 enteros e imprime cada elemento.',
   E'public class Main {\n    public static void main(String[] args) {\n        int[] nums = {3, 7, 1, 9, 4};\n        // escribe aquí\n    }\n}',
   E'public class Main {\n    public static void main(String[] args) {\n        int[] nums = {3, 7, 1, 9, 4};\n        for (int n : nums) System.out.println(n);\n    }\n}',
   'java', 'medium', 100, 5),

  (true, 'Suma de una matriz',
   'Calcula la suma de todos los elementos de una matriz 3x3.',
   E'public class Main {\n    public static void main(String[] args) {\n        int[][] m = {{1,2,3},{4,5,6},{7,8,9}};\n        // escribe aquí\n    }\n}',
   E'public class Main {\n    public static void main(String[] args) {\n        int[][] m = {{1,2,3},{4,5,6},{7,8,9}};\n        int sum = 0;\n        for (int[] row : m) for (int x : row) sum += x;\n        System.out.println(sum);\n    }\n}',
   'java', 'hard', 100, 6);
