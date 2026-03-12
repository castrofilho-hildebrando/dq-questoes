import classicDossieIf from "@/assets/gateway/classic-card-dossie-if.jpg";
import classicCodigoIf from "@/assets/gateway/classic-card-codigo-if.jpg";
import classicConselhoIf from "@/assets/gateway/classic-card-conselho-if.jpg";
import classicMapaQuestoes from "@/assets/gateway/classic-card-mapa-questoes.jpg";
import classicBancoQuestoes from "@/assets/gateway/classic-card-banco-questoes.jpg";
import classicRoboTutor from "@/assets/gateway/classic-card-robo-tutor.jpg";
import classicRevisaoTatica from "@/assets/gateway/classic-card-revisao-tatica.jpg";
import classicMateriaisDissecados from "@/assets/gateway/classic-card-materiais-dissecados.jpg";
import classicDissertativa from "@/assets/gateway/classic-card-dissertativa.jpg";
import classicDidatica from "@/assets/gateway/classic-card-didatica.jpg";
import classicComunidades from "@/assets/gateway/classic-card-comunidades.jpg";
import classicBanner from "@/assets/gateway/classic-banner.jpg";
import classicTexture from "@/assets/gateway/classic-texture-v2.jpg";

export interface CourseArea {
  id: string;
  name: string;
  description: string;
  locked: boolean;
  link?: string;
  /** Card oculto — não aparece no Gateway */
  hidden?: boolean;
  /** Módulo ainda não disponível — exibe badge "Em Breve" */
  comingSoon?: boolean;
  /** Força o cadeado independente do acesso no banco */
  forceLocked?: boolean;
}

export interface Section {
  id: string;
  title: string;
  areas: CourseArea[];
}

export const gatewayCards: Record<string, string> = {
  "dossie-if": classicDossieIf,
  "codigo-if": classicCodigoIf,
  "conselho-if": classicConselhoIf,
  "mapa-questoes": classicMapaQuestoes,
  "banco-questoes": classicBancoQuestoes,
  "robo-tutor": classicRoboTutor,
  "revisao-tatica": classicRevisaoTatica,
  "materiais-dissecados": classicMateriaisDissecados,
  "dissecando-dissertativa": classicDissertativa,
  "dissecando-didatica": classicDidatica,
  "comunidades-dissecadores": classicComunidades,
};

export const gatewayBanner = classicBanner;
export const gatewayTexture = classicTexture;
export const gatewayTextureOpacity = 0.85;

export const gatewaySections: Section[] = [
  {
    id: "preparacoes-dq",
    title: "Preparações DQ",
    areas: [
      {
        id: "dossie-if",
        name: "Dossiê IF",
        description: "Acesse seu dossiê completo de estudos e acompanhe seu progresso.",
        locked: false,
        link: "/dossie-if",
      },
      {
        id: "codigo-if",
        name: "Código IF",
        description: "Desvende os códigos e padrões das avaliações.",
        locked: true,
        link: "/codigo-if",
      },
      {
        id: "conselho-if",
        name: "O Conselho IF",
        description: "Orientações estratégicas dos nossos especialistas.",
        locked: true,
        link: "/conselho-if",
      },
    ],
  },
  {
    id: "ferramentas-dq",
    title: "Ferramentas DQ",
    areas: [
      {
        id: "mapa-questoes",
        name: "Mapa das Questões",
        description: "Visualize o mapa completo das questões por tema e área.",
        locked: true,
        link: "/mapa-das-questoes",
      },
      {
        id: "banco-questoes",
        name: "Questões Ultraselecionadas",
        description: "Banco de questões curado com os melhores exercícios.",
        locked: true,
        link: "/banco-questoes/dashboard",
      },
      {
        id: "robo-tutor",
        name: "Robô Tutor",
        description: "Inteligência artificial para auxiliar seus estudos.",
        locked: true,
        link: "/tutor",
      },
      {
        id: "revisao-tatica",
        name: "Revisão Tática",
        description: "Flashcards inteligentes para revisão estratégica.",
        locked: true,
        comingSoon: true,
        link: "/revisao-tatica",
      },
    ],
  },
  {
    id: "cursos-materiais",
    title: "Cursos, Materiais e Comunidades",
    areas: [
      {
        id: "materiais-dissecados",
        name: "Materiais Dissecados",
        description: "Materiais de estudo aprofundados e detalhados.",
        locked: true,
        link: "/materiais-dissecados",
      },
      {
        id: "dissecando-dissertativa",
        name: "Dissecando a Dissertativa",
        description: "Domine a arte da dissertação com técnicas avançadas.",
        locked: true,
        link: "/dissertativa",
      },
      {
        id: "dissecando-didatica",
        name: "Dissecando a Didática",
        description: "Aperfeiçoe sua didática com métodos comprovados.",
        locked: true,
        link: "/didatica",
      },
      {
        id: "comunidades-dissecadores",
        name: "Comunidades Dissecadores",
        description: "Conecte-se com outros estudantes e troque experiências.",
        locked: true,
        link: "/comunidades",
      },
    ],
  },
];
