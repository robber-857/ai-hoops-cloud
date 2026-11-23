import { templateDisplayName } from "@/lib/templateLanguage";
import type { AppLanguage } from "@/lib/language";
import type { ActionTemplate } from "@/config/templates";

export type MovementPose = {
  label: string;
  head: [number, number];
  trunk: string;
  arms: string;
  legs: string;
  equipment?: string;
  ball?: [number, number];
};

const standing: MovementPose = {
  label: "Stand tall",
  head: [64, 24],
  trunk: "M64 32V65",
  arms: "M64 41L52 57L53 70 M64 41L76 57L75 70",
  legs: "M64 65L58 88L58 109H66 M64 65L69 88L69 109H77",
};

const frontDribble: MovementPose = {
  label: "Keep a balanced stance",
  head: [64, 29],
  trunk: "M64 38V69",
  arms: "M64 45L45 55L35 66 M64 45L79 59L70 61",
  legs: "M64 69L45 88L40 109H49 M64 69L83 88L88 109H97",
};

const sideDribble: MovementPose = {
  label: "Bend your knees",
  head: [65, 31],
  trunk: "M61 40L50 71",
  arms: "M58 46L76 58L91 67",
  legs: "M50 71L67 89L60 109H74 M50 71L53 89L46 109H58",
};

// Joint paths are authored for the same camera angle and movement that the scorer expects.
const examplePoses: Record<string, MovementPose[]> = {
  shoot_front_form_close: [{
    ...standing,
    label: "Set the ball",
    arms: "M64 43L48 48L49 28 M64 43L77 49L64 29",
    ball: [53, 20],
  }, {
    ...standing,
    label: "Extend and follow through",
    arms: "M64 43L52 28L51 9L57 8 M64 43L77 46L74 35",
    ball: [58, 3],
  }],
  shoot_side_form_close: [{
    ...standing,
    label: "Set the ball above your elbow",
    arms: "M64 43L86 47L86 27",
    ball: [87, 18],
  }, {
    ...standing,
    label: "Reach up and finish",
    arms: "M64 43L80 24L91 9L96 13",
    ball: [106, 4],
  }],
  dribble_front_narrow_crossover: [{
    ...frontDribble,
    label: "Start on one side",
    ball: [36, 72],
  }, {
    ...frontDribble,
    label: "Receive on the other side",
    arms: "M64 45L49 59L58 61 M64 45L83 55L93 66",
    ball: [92, 72],
  }],
  dribble_front_onehand_oneside_height: [{
    ...frontDribble,
    label: "Meet the ball at hip height",
    ball: [35, 72],
  }, {
    ...frontDribble,
    label: "Bounce on the same side",
    ball: [35, 103],
  }],
  dribble_front_onehand_v: [{
    ...frontDribble,
    label: "Push outside",
    ball: [34, 74],
  }, {
    ...frontDribble,
    label: "Pull back with the same hand",
    arms: "M64 45L48 58L57 65 M64 45L79 59L70 61",
    ball: [57, 73],
  }],
  dribble_side_narrow_crossover: [{
    ...sideDribble,
    label: "Push the ball low in front",
    ball: [92, 87],
  }, {
    ...sideDribble,
    label: "Receive with your other hand",
    arms: "M58 46L69 54L84 68 M58 46L76 59L94 73",
    ball: [88, 76],
  }],
  dribble_side_onehand_oneside: [{
    ...sideDribble,
    label: "Receive on the same side",
    ball: [91, 75],
  }, {
    ...sideDribble,
    label: "Bounce just in front of your toes",
    ball: [82, 103],
  }],
  high_knees_in_place_side: [standing, {
    label: "Lift one knee",
    head: [62, 23], trunk: "M61 33L60 65",
    arms: "M60 42L47 57L39 45 M60 42L73 49L83 34",
    legs: "M60 65L63 88L65 109H74 M60 65L91 62L91 82H100",
  }],
  pushup_hold_high_plank: [{
    label: "Hold a straight line",
    head: [99, 53], trunk: "M89 61L61 69",
    arms: "M87 62V109H107",
    legs: "M61 69L41 86L21 105L22 109",
  }],
  wall_sit_half_hold: [{
    label: "Hold a lower seat",
    head: [45, 23], trunk: "M43 33L42 67",
    arms: "M43 40L52 56L64 66", legs: "M42 67L75 68L76 109H88",
    equipment: "M32 17V109",
  }],
  wall_sit_quarter_hold: [{
    label: "Hold a shallow seat",
    head: [45, 14], trunk: "M43 24L42 57",
    arms: "M43 35L52 49L66 60", legs: "M42 57L70 76L62 109H74",
    equipment: "M32 10V109",
  }],
  deep_squat_reps_side: [standing, {
    label: "Sit down and back",
    head: [73, 36], trunk: "M68 45L49 72",
    arms: "M63 49L83 45L99 45", legs: "M49 72L77 73L69 109H83",
  }],
  jumping_jack_reps_front: [{ ...standing, label: "Feet together" }, {
    label: "Feet apart, arms up",
    head: [64, 24], trunk: "M64 34V66",
    arms: "M64 43L49 40L39 23L36 11 M64 43L79 40L89 23L92 11",
    legs: "M64 66L47 85L33 109H42 M64 66L81 85L95 109H104",
  }],
  lunge_same_side_reps_side: [{
    ...standing, label: "Set your split stance",
    legs: "M64 65L47 88L32 109H39 M64 65L80 88L92 109H101",
  }, {
    label: "Lower the rear knee",
    head: [64, 35], trunk: "M64 45V76",
    arms: "M64 52L54 64L63 72 M64 52L72 64L64 72",
    legs: "M64 76L52 102L32 109H38 M64 76L89 77L89 109H103",
  }],
  pushup_reps_side: [{
    label: "Start with straight arms",
    head: [99, 51], trunk: "M90 60L61 69",
    arms: "M88 62V109H99", legs: "M61 69L42 86L21 108H28",
  }, {
    label: "Lower your chest",
    head: [104, 83], trunk: "M94 90L62 95",
    arms: "M91 92L76 91L88 109H98", legs: "M62 95L42 101L21 108H28",
  }],
  single_leg_stand_front: [{
    label: "Balance on one foot",
    head: [64, 24], trunk: "M64 34V65 M56 65H72",
    arms: "M64 43L49 50L39 44 M64 43L78 50L89 44",
    legs: "M58 65L58 87L57 109H65 M70 65L79 86L73 95H82",
  }],
  jump_rope_basic_front: [{
    ...standing, label: "Start with feet together",
    arms: "M64 43L50 56L41 57 M64 43L78 56L87 57",
    equipment: "M41 57C16 86 35 112 64 112S112 86 87 57",
  }, {
    label: "Jump on both feet",
    head: [64, 16], trunk: "M64 26V57",
    arms: "M64 35L50 48L41 49 M64 35L78 48L87 49",
    legs: "M64 57L58 79L58 98H66 M64 57L70 79L70 98H78",
    equipment: "M41 49C17 75 32 106 64 106S111 75 87 49",
  }],
};

const basketballPresentation: Record<string, { filming: string }> = {
  shoot_front_form_close: {
    filming: "Film from the front. Keep your feet, shooting elbow, hands, and ball release in frame.",
  },
  shoot_side_form_close: {
    filming: "Film from the side of your shooting arm. Keep your feet, hip, elbow, and ball release in frame.",
  },
  dribble_front_narrow_crossover: {
    filming: "Film from the front with both hands, both feet, and the ball visible. Keep the crossover close to your stance.",
  },
  dribble_front_onehand_oneside_height: {
    filming: "Film from the front with both feet and the ball visible. Keep the bounce on one side and meet the ball near your hip.",
  },
  dribble_front_onehand_v: {
    filming: "Film from the front so the floor and ball are visible as you move the ball in and out with the same hand.",
  },
  dribble_side_narrow_crossover: {
    filming: "Film from the side with your whole body and the ball in frame. Keep the crossover low and close to your feet.",
  },
  dribble_side_onehand_oneside: {
    filming: "Film from the side of your dribbling hand. Keep your feet and the ball in frame as it lands just ahead of your toes.",
  },
};

export function getMovementPresentation(template: ActionTemplate, language: AppLanguage = "en") {
  const basketball = basketballPresentation[template.templateId];
  return {
    title: templateDisplayName(template.templateId, template.displayName, language),
    filming: basketball?.filming ?? template.cameraInstructions,
    poses: examplePoses[template.templateId] ?? [],
  };
}
