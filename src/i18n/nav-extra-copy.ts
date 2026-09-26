/**
 * Short menu/footer labels for the 2026-09-26 visibility pages.
 *
 * The pages' own <title>/<h1> are long, keyword-shaped strings ("Travel Safety
 * Index 2026: …") that would overflow the Rankings dropdown and the footer
 * row, so the navigation gets these short forms instead. Kept out of ui.ts
 * (merge hot spot) like the pages' own copy modules. English uses Title Case
 * like the rest of the menu; the other languages use their native sentence
 * case.
 */
import type { Lang } from './ui';

export interface NavExtraCopy {
  travelSafetyIndex: string;
  communityVsData: string;
  governmentAdvisories: string;
  governmentsDisagree: string;
}

export const navExtraCopy: Record<Lang, NavExtraCopy> = {
  en: {
    travelSafetyIndex: 'Travel Safety Index',
    communityVsData: 'Community vs. Data',
    governmentAdvisories: 'Government Travel Advisories',
    governmentsDisagree: 'Where Governments Disagree',
  },
  it: {
    travelSafetyIndex: 'Indice di sicurezza dei viaggi',
    communityVsData: 'Community vs. dati',
    governmentAdvisories: 'Avvisi di viaggio dei governi',
    governmentsDisagree: 'Dove i governi non concordano',
  },
  es: {
    travelSafetyIndex: 'Índice de seguridad para viajar',
    communityVsData: 'Comunidad vs. datos',
    governmentAdvisories: 'Avisos de viaje de los gobiernos',
    governmentsDisagree: 'Dónde discrepan los gobiernos',
  },
  fr: {
    travelSafetyIndex: 'Indice de sécurité des voyages',
    communityVsData: 'Communauté vs données',
    governmentAdvisories: 'Conseils aux voyageurs des gouvernements',
    governmentsDisagree: 'Où les gouvernements divergent',
  },
  pt: {
    travelSafetyIndex: 'Índice de segurança para viagens',
    communityVsData: 'Comunidade vs. dados',
    governmentAdvisories: 'Alertas de viagem dos governos',
    governmentsDisagree: 'Onde os governos divergem',
  },
  zh: {
    travelSafetyIndex: '旅行安全指数',
    communityVsData: '社区评价 vs 数据',
    governmentAdvisories: '各国政府旅行警示',
    governmentsDisagree: '各国政府的分歧',
  },
  de: {
    travelSafetyIndex: 'Reisesicherheitsindex',
    communityVsData: 'Community vs. Daten',
    governmentAdvisories: 'Reisewarnungen der Regierungen',
    governmentsDisagree: 'Wo Regierungen uneins sind',
  },
};
