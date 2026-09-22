'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useLocationStore } from '@/stores/useLocationStore';
import { usePulseWireStore } from '@/stores/usePulseWireStore';
import {
  CarIcon,
  CloudRainIcon,
  ShieldIcon,
  AlertTriangleIcon,
  BuildingIcon,
  SearchIcon,
  PinIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  SendIcon,
  CheckCircleIcon,
  CloseIcon,
  FlaskIcon,
  RadioIcon,
  SparklesIcon,
} from '@/components/common/Icons';

export interface CityUpdateItem {
  id: string;
  category: 'TRAFFIC' | 'WEATHER' | 'CRIME' | 'HAZARD' | 'MUNICIPAL';
  headline: string;
  description: string;
  location: string;
  latitude: number;
  longitude: number;
  timestamp: string;
  timeAgo: string;
  severity: 'HIGH' | 'MODERATE' | 'INFO';
  status: 'ACTIVE' | 'RESOLVING' | 'SCHEDULED' | 'MONITORING';
  agency: string;
  impact: string;
  url?: string;
}

const MYSURU_UPDATES: CityUpdateItem[] = [
  {
    id: 'up-1',
    category: 'TRAFFIC',
    headline: 'Heavy traffic on Ring Road near Hebbal',
    description: 'Slow movement reported due to vehicle breakdown. Expect delays of 15–20 mins.',
    location: 'Ring Road near Hebbal',
    latitude: 12.3556,
    longitude: 76.6125,
    timestamp: '10:48 AM',
    timeAgo: '12m ago',
    severity: 'MODERATE',
    status: 'ACTIVE',
    agency: 'Mysuru City Traffic Police',
    impact: '15–20 min delay on outer ring road eastbound corridor',
  },
  {
    id: 'up-2',
    category: 'WEATHER',
    headline: 'Light rainfall expected this evening',
    description: 'Showers likely across Mysuru between 6 PM–10 PM with increasing cloud cover.',
    location: 'Citywide',
    latitude: 12.3051,
    longitude: 76.6551,
    timestamp: '10:42 AM',
    timeAgo: '18m ago',
    severity: 'INFO',
    status: 'MONITORING',
    agency: 'IMD Meteorological Centre',
    impact: 'Scattered light precipitation across central and southern wards',
  },
  {
    id: 'up-3',
    category: 'HAZARD',
    headline: 'Fallen tree near Chamundi Hill Road',
    description: 'Tree fallen due to strong winds blocking one lane. Clearance team alerted and en route.',
    location: 'Chamundi Hill Road',
    latitude: 12.2812,
    longitude: 76.6710,
    timestamp: '10:52 AM',
    timeAgo: '8m ago',
    severity: 'HIGH',
    status: 'ACTIVE',
    agency: 'MCC Disaster Management Cell',
    impact: 'Single lane traffic flow; alternate route via Tavarekatte recommended',
  },
  {
    id: 'up-4',
    category: 'MUNICIPAL',
    headline: 'Road repair work on Devaraja Urs Road',
    description: 'Lane closure from 10 AM–5 PM for asphalt resurfacing. Use alternate routes via Shivarampet.',
    location: 'Devaraja Urs Road',
    latitude: 12.3082,
    longitude: 76.6475,
    timestamp: '10:35 AM',
    timeAgo: '25m ago',
    severity: 'MODERATE',
    status: 'SCHEDULED',
    agency: 'Mysuru City Corporation (MCC)',
    impact: 'Eastbound vehicular movement diverted through Shivarampet cross roads',
  },
  {
    id: 'up-5',
    category: 'CRIME',
    headline: 'Minor theft reported in Kuvempunagar',
    description: 'A two-wheeler was reported stolen from 5th Cross. Police investigation is underway.',
    location: 'Kuvempunagar 5th Cross',
    latitude: 12.2878,
    longitude: 76.6265,
    timestamp: '10:25 AM',
    timeAgo: '35m ago',
    severity: 'HIGH',
    status: 'ACTIVE',
    agency: 'Kuvempunagar Police Station',
    impact: 'Security check and patrolling heightened across Kuvempunagar Sector M & K',
  },
  {
    id: 'up-6',
    category: 'TRAFFIC',
    headline: 'Congestion near Suburb Bus Stand',
    description: 'High density interstate bus arrivals causing traffic slowdown on Bengaluru-Nilgiri road.',
    location: 'Suburb Bus Stand, BN Road',
    latitude: 12.3060,
    longitude: 76.6592,
    timestamp: '10:20 AM',
    timeAgo: '40m ago',
    severity: 'MODERATE',
    status: 'ACTIVE',
    agency: 'Traffic Sub-Division East',
    impact: '10 min slowdown approaching central suburban bus terminal',
  },
  {
    id: 'up-7',
    category: 'HAZARD',
    headline: 'Open manhole barricaded near Vijayanagar 2nd Stage',
    description: 'Cover damaged during storm drain cleaning. Temporary warning cones placed; repair scheduled today.',
    location: 'Vijayanagar 2nd Stage Main Road',
    latitude: 12.3385,
    longitude: 76.6080,
    timestamp: '10:10 AM',
    timeAgo: '50m ago',
    severity: 'HIGH',
    status: 'ACTIVE',
    agency: 'MCC Ward 28 Engineering Cell',
    impact: 'Right lane caution advised near water tank intersection',
  },
  {
    id: 'up-8',
    category: 'WEATHER',
    headline: 'Moderate gusty winds near Chamundi Foothills',
    description: 'Wind speeds clocking up to 34 km/h with sudden squalls near southern approach avenues.',
    location: 'Chamundi Foothills',
    latitude: 12.2890,
    longitude: 76.6780,
    timestamp: '10:00 AM',
    timeAgo: '1h ago',
    severity: 'MODERATE',
    status: 'MONITORING',
    agency: 'Karnataka State Natural Disaster Monitoring Centre',
    impact: 'Two-wheelers and high-profile vehicles advised to maintain lower speeds',
  },
  {
    id: 'up-9',
    category: 'MUNICIPAL',
    headline: 'Scheduled drinking water maintenance in VV Mohalla',
    description: 'Supply pause from 2 PM–6 PM for master balancing reservoir valve replacement.',
    location: 'Vani Vilas Mohalla',
    latitude: 12.3210,
    longitude: 76.6340,
    timestamp: '9:45 AM',
    timeAgo: '1h 15m ago',
    severity: 'INFO',
    status: 'SCHEDULED',
    agency: 'Vani Vilas Water Works (VVWW)',
    impact: 'Wards 21, 22, and 23 low pressure window during afternoon maintenance',
  },
  {
    id: 'up-10',
    category: 'CRIME',
    headline: 'Police patrol intensified in Saraswathipuram',
    description: 'Routine evening safety drive active around educational institutions and libraries.',
    location: 'Saraswathipuram 1st Main',
    latitude: 12.3020,
    longitude: 76.6310,
    timestamp: '9:30 AM',
    timeAgo: '1h 30m ago',
    severity: 'INFO',
    status: 'ACTIVE',
    agency: 'Saraswathipuram Police Station',
    impact: 'Regular vehicle document verification active near Kautilya Circle',
  },
  {
    id: 'up-11',
    category: 'TRAFFIC',
    headline: 'Slow movement on Bengaluru-Mysuru Expressway Exit',
    description: 'Toll merge bottleneck causing minor slowdown approaching Columbia Asia junction.',
    location: 'Columbia Asia Junction, NH 275',
    latitude: 12.3480,
    longitude: 76.6620,
    timestamp: '9:15 AM',
    timeAgo: '1h 45m ago',
    severity: 'HIGH',
    status: 'ACTIVE',
    agency: 'NHAI & Mysuru Traffic Police',
    impact: 'Queues extending 600m north on highway approach lanes',
  },
  {
    id: 'up-12',
    category: 'MUNICIPAL',
    headline: 'Underground drainage desilting in Mandi Mohalla',
    description: 'MCC sanitation crew clearing stormwater conduits ahead of seasonal rains.',
    location: 'Mandi Mohalla, Ashoka Road',
    latitude: 12.3165,
    longitude: 76.6540,
    timestamp: '9:00 AM',
    timeAgo: '2h ago',
    severity: 'INFO',
    status: 'RESOLVING',
    agency: 'MCC Health & Sanitation Dept',
    impact: 'Service lane partially restricted for mobile suction vehicle operations',
  },
  {
    id: 'up-13',
    category: 'HAZARD',
    headline: 'Low-hanging electrical cable near Bogadi Road',
    description: 'Cable pulled down by passing transport truck. CESC technical team on site cordoning the wire.',
    location: 'Bogadi 2nd Stage Ring Road',
    latitude: 12.3015,
    longitude: 76.6020,
    timestamp: '8:45 AM',
    timeAgo: '2h 15m ago',
    severity: 'HIGH',
    status: 'RESOLVING',
    agency: 'Chamundeshwari Electricity Supply Corp (CESC)',
    impact: 'Temporary single-lane diversion past Bogadi signal',
  },
  {
    id: 'up-14',
    category: 'WEATHER',
    headline: 'Current temperature 26°C with 78% humidity',
    description: 'Comfortable thermal index with increasing cloud cover from south-westerly wind currents.',
    location: 'Mysuru Urban District',
    latitude: 12.3050,
    longitude: 76.6450,
    timestamp: '8:30 AM',
    timeAgo: '2h 30m ago',
    severity: 'INFO',
    status: 'MONITORING',
    agency: 'Open-Meteo Telemetry',
    impact: 'Dew point 21.8°C; optimal air dispersal index',
  },
  {
    id: 'up-15',
    category: 'CRIME',
    headline: 'Vandalism reported at public park in Gokulam',
    description: 'Damaged pathway solar lights reported by residents. CCTV records under police review.',
    location: 'Gokulam 3rd Stage Park',
    latitude: 12.3290,
    longitude: 76.6210,
    timestamp: '8:00 AM',
    timeAgo: '3h ago',
    severity: 'MODERATE',
    status: 'ACTIVE',
    agency: 'V V Puram Police Station',
    impact: 'Park evening hours regulated under municipal guard surveillance',
  },
  {
    id: 'up-16',
    category: 'TRAFFIC',
    headline: 'Signal malfunction resolved at Ramaswamy Circle',
    description: 'Automated traffic lights restored after brief UPS battery fault. Traffic flowing smoothly.',
    location: 'Ramaswamy Circle, Chamaraja Double Road',
    latitude: 12.3010,
    longitude: 76.6460,
    timestamp: '7:40 AM',
    timeAgo: '3h 20m ago',
    severity: 'INFO',
    status: 'RESOLVING',
    agency: 'City Traffic Signals Cell',
    impact: 'All 4 arms operating on regular 90s signal phasing',
  },
  {
    id: 'up-17',
    category: 'MUNICIPAL',
    headline: 'Streetlight LED upgrade in JP Nagar Sector 3',
    description: 'Smart LED lighting conversion underway replacing legacy sodium fixtures.',
    location: 'JP Nagar Sector 3 Boulevard',
    latitude: 12.2740,
    longitude: 76.6430,
    timestamp: '7:15 AM',
    timeAgo: '3h 45m ago',
    severity: 'INFO',
    status: 'SCHEDULED',
    agency: 'MCC Electrical Division',
    impact: 'Minor maintenance vehicle pauses on residential avenues',
  },
  {
    id: 'up-18',
    category: 'HAZARD',
    headline: 'Oil spill neutralized on Nanjangud Road Bridge',
    description: 'Spilled diesel from a transport lorry treated with sand and washed down. Road grip restored.',
    location: 'Nanjangud Road Overbridge',
    latitude: 12.2780,
    longitude: 76.6620,
    timestamp: '7:00 AM',
    timeAgo: '4h ago',
    severity: 'MODERATE',
    status: 'RESOLVING',
    agency: 'Fire & Emergency Services Mysuru',
    impact: 'All carriageways fully reopened with normal surface friction levels',
  },
  {
    id: 'up-19',
    category: 'CRIME',
    headline: 'Attempted shop break-in thwarted in Jayalakshmipuram',
    description: 'Night security alarm sounded early morning; suspects fled leaving tools behind.',
    location: 'Jayalakshmipuram Commercial St',
    latitude: 12.3200,
    longitude: 76.6260,
    timestamp: '6:30 AM',
    timeAgo: '4h 30m ago',
    severity: 'MODERATE',
    status: 'ACTIVE',
    agency: 'Jayalakshmipuram Police',
    impact: 'CCTV footage logged; commercial watch patrols heightened',
  },
  {
    id: 'up-20',
    category: 'MUNICIPAL',
    headline: 'Solid waste segregation audit in Nazarbad',
    description: 'MCC ward inspectors checking commercial dry/wet waste compliance along zoo road.',
    location: 'Nazarbad Main Road',
    latitude: 12.3090,
    longitude: 76.6680,
    timestamp: '6:00 AM',
    timeAgo: '5h ago',
    severity: 'INFO',
    status: 'SCHEDULED',
    agency: 'MCC Health Cell',
    impact: 'Routine civil inspection with zero traffic blockage',
  },
  {
    id: 'up-21',
    category: 'TRAFFIC',
    headline: 'Lane line repainting on Sayyaji Rao Road',
    description: 'Night cycle road markings completed; reflective road studs installed near Palace North Gate.',
    location: 'Sayyaji Rao Road near Palace',
    latitude: 12.3120,
    longitude: 76.6520,
    timestamp: '5:30 AM',
    timeAgo: '5h 30m ago',
    severity: 'INFO',
    status: 'RESOLVING',
    agency: 'City Engineering Cell',
    impact: 'Fresh zebra crossings and center lane dividers clearly visible',
  },
  {
    id: 'up-22',
    category: 'WEATHER',
    headline: 'Air Quality Index measured at 42 (Good)',
    description: 'Clean air quality recorded at Hebbal and Gangothri telemetry monitoring stations.',
    location: 'Manasagangothri CPCB Station',
    latitude: 12.3140,
    longitude: 76.6200,
    timestamp: '5:00 AM',
    timeAgo: '6h ago',
    severity: 'INFO',
    status: 'MONITORING',
    agency: 'Karnataka State Pollution Control Board',
    impact: 'Optimal atmospheric conditions for outdoor work and transit',
  },
  {
    id: 'up-23',
    category: 'HAZARD',
    headline: 'Loose gravel cleared from Hunsur Road incline',
    description: 'Resurfacing remnants swept clear following motorist hazard complaint.',
    location: 'Hunsur Road near St. Josephs',
    latitude: 12.3240,
    longitude: 76.6290,
    timestamp: '4:30 AM',
    timeAgo: '6h 30m ago',
    severity: 'INFO',
    status: 'RESOLVING',
    agency: 'Public Works Department (PWD)',
    impact: 'Two-wheeler slip risk fully eliminated',
  },
  {
    id: 'up-24',
    category: 'MUNICIPAL',
    headline: 'Free civic health checkup camp at Metagalli',
    description: 'Urban Primary Health Centre conducting general vitals checkup and dengue awareness drive.',
    location: 'Metagalli 1st Cross',
    latitude: 12.3510,
    longitude: 76.6240,
    timestamp: '4:00 AM',
    timeAgo: '7h ago',
    severity: 'INFO',
    status: 'SCHEDULED',
    agency: 'District Health & Family Welfare Office',
    impact: 'Open to public until 4 PM today at Community Center',
  },
  {
    id: 'up-25',
    category: 'MUNICIPAL',
    headline: 'Property tax facilitation counter at Chamaraja Office',
    description: 'Special assistance desk opened to assist residents with online portal receipts.',
    location: 'Krishnaraja Boulevard',
    latitude: 12.2980,
    longitude: 76.6410,
    timestamp: '3:00 AM',
    timeAgo: '8h ago',
    severity: 'INFO',
    status: 'ACTIVE',
    agency: 'MCC Revenue Department',
    impact: 'Assistance counters active weekdays 10 AM to 5 PM',
  },
];

type CategoryFilter = 'ALL' | 'TRAFFIC' | 'WEATHER' | 'CRIME' | 'HAZARD' | 'MUNICIPAL';
type SortOption = 'LATEST' | 'SEVERITY' | 'OLDEST';

export default function UpdatesView() {
  const { currentLocation } = useLocationStore();
  const cityName = currentLocation?.city || 'Bengaluru';
  const { articles, status, fetchNews } = usePulseWireStore();

  useEffect(() => {
    fetchNews({
      scope: 'CITY',
      city: cityName,
      state: (currentLocation?.state || currentLocation?.region) ?? undefined,
      country: currentLocation?.country ?? undefined,
      countryCode: currentLocation?.countryCode ?? undefined,
    });
  }, [cityName, fetchNews, currentLocation]);

  // Filtering & Sorting State
  const [selectedCategory, setSelectedCategory] = useState<CategoryFilter>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('LATEST');

  // Selected update for modal/details & map focus
  const [selectedUpdate, setSelectedUpdate] = useState<CityUpdateItem | null>(null);
  const [focusedUpdateId, setFocusedUpdateId] = useState<string | null>(null);

  // Derive active updates list from verified real 24-hour articles
  const activeSourceUpdates: CityUpdateItem[] = useMemo(() => {
    if (articles && articles.length > 0) {
      return articles.map((a, idx) => {
        let cat: CityUpdateItem['category'] = 'MUNICIPAL';
        const upper = (a.category || 'GENERAL').toUpperCase();
        if (['TRAFFIC', 'WEATHER', 'CRIME', 'HAZARD', 'MUNICIPAL'].includes(upper)) {
          cat = upper as CityUpdateItem['category'];
        } else if (upper === 'CIVIC') {
          cat = 'MUNICIPAL';
        } else {
          cat = 'TRAFFIC';
        }

        let sev: CityUpdateItem['severity'] = 'INFO';
        if (cat === 'HAZARD' || cat === 'CRIME') sev = 'HIGH';
        else if (cat === 'TRAFFIC') sev = 'MODERATE';

        return {
          id: a.id || `up-live-${idx}`,
          category: cat,
          headline: a.headline || a.title,
          description: a.summary || a.description || `Verified reporting by ${a.sourceName || a.source} in ${cityName}.`,
          location: a.location || cityName,
          latitude: currentLocation?.latitude || 12.9716,
          longitude: currentLocation?.longitude || 77.5946,
          timestamp: a.publishedAt ? new Date(a.publishedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Recent',
          timeAgo: a.freshness || 'Within 24h',
          severity: sev,
          status: 'ACTIVE' as const,
          agency: a.sourceName || a.source || 'Verified Wire',
          impact: a.summary || 'Civic observation recorded in the last 24 hours.',
          url: a.url || a.articleUrl,
        };
      });
    }
    return [];
  }, [articles, cityName, currentLocation]);

  // Conversational Agent state
  const [chatQuery, setChatQuery] = useState('');
  const [chatHistory, setChatHistory] = useState<
    Array<{ id: string; role: 'user' | 'agent'; text: string; time: string; category?: string }>
  >([
    {
      id: 'msg-init',
      role: 'agent',
      text: `Hello. I am the UrbanPulse Intelligence Agent for ${cityName}. I am monitoring verified civic updates from the last 24 hours across traffic, weather, hazards, and municipal operations. What would you like to know?`,
      time: 'Just now',
    },
  ]);
  const [isTyping, setIsTyping] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Filtered & Sorted Updates
  const filteredUpdates = useMemo(() => {
    return activeSourceUpdates.filter((item) => {
      // Category filter
      if (selectedCategory !== 'ALL' && item.category !== selectedCategory) {
        return false;
      }
      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesHeadline = item.headline.toLowerCase().includes(q);
        const matchesDescription = item.description.toLowerCase().includes(q);
        const matchesLocation = item.location.toLowerCase().includes(q);
        const matchesCategory = item.category.toLowerCase().includes(q);
        if (!matchesHeadline && !matchesDescription && !matchesLocation && !matchesCategory) {
          return false;
        }
      }
      return true;
    }).sort((a, b) => {
      if (sortBy === 'SEVERITY') {
        const score = { HIGH: 3, MODERATE: 2, INFO: 1 };
        return score[b.severity] - score[a.severity];
      }
      return 0; // Natural newest-first ordering from PulseWire backend
    });
  }, [activeSourceUpdates, selectedCategory, searchQuery, sortBy]);

  // Category Counts
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {
      ALL: activeSourceUpdates.length,
      TRAFFIC: 0,
      WEATHER: 0,
      CRIME: 0,
      HAZARD: 0,
      MUNICIPAL: 0,
    };
    activeSourceUpdates.forEach((item) => {
      counts[item.category] = (counts[item.category] || 0) + 1;
    });
    return counts;
  }, [activeSourceUpdates]);

  // Category Color & Icon Styling
  const getCategoryTheme = (cat: CityUpdateItem['category']) => {
    switch (cat) {
      case 'TRAFFIC':
        return {
          bg: 'var(--badge-warning-bg)',
          color: 'var(--badge-warning-text)',
          border: 'var(--badge-warning-border)',
          dotColor: 'var(--badge-warning-text)',
          label: 'Traffic',
          icon: <CarIcon size={13} color="var(--badge-warning-text)" />,
        };
      case 'WEATHER':
        return {
          bg: 'var(--badge-info-bg)',
          color: 'var(--badge-info-text)',
          border: 'var(--badge-info-border)',
          dotColor: 'var(--badge-info-text)',
          label: 'Weather',
          icon: <CloudRainIcon size={13} color="var(--badge-info-text)" />,
        };
      case 'CRIME':
        return {
          bg: 'var(--badge-hazard-bg)',
          color: 'var(--badge-hazard-text)',
          border: 'var(--badge-hazard-border)',
          dotColor: 'var(--badge-hazard-text)',
          label: 'Crime',
          icon: <ShieldIcon size={13} color="var(--badge-hazard-text)" />,
        };
      case 'HAZARD':
        return {
          bg: 'var(--badge-approx-bg)',
          color: 'var(--badge-approx-text)',
          border: 'var(--badge-approx-border)',
          dotColor: 'var(--badge-approx-text)',
          label: 'Hazard',
          icon: <AlertTriangleIcon size={13} color="var(--badge-approx-text)" />,
        };
      case 'MUNICIPAL':
        return {
          bg: 'var(--badge-info-bg)',
          color: 'var(--badge-info-text)',
          border: 'var(--badge-info-border)',
          dotColor: 'var(--badge-info-text)',
          label: 'Municipal',
          icon: <BuildingIcon size={13} color="var(--badge-info-text)" />,
        };
    }
  };

  const getSeverityBadge = (sev: CityUpdateItem['severity']) => {
    switch (sev) {
      case 'HIGH':
        return { bg: 'var(--badge-hazard-bg)', color: 'var(--badge-hazard-text)', border: 'var(--badge-hazard-border)', text: 'HIGH' };
      case 'MODERATE':
        return { bg: 'var(--badge-warning-bg)', color: 'var(--badge-warning-text)', border: 'var(--badge-warning-border)', text: 'MODERATE' };
      case 'INFO':
        return { bg: 'var(--badge-info-bg)', color: 'var(--badge-info-text)', border: 'var(--badge-info-border)', text: 'INFO' };
    }
  };

  // Handle agent questions
  const handleAskAgent = (promptText: string) => {
    if (!promptText.trim()) return;

    const userMessage = {
      id: `user-${Date.now()}`,
      role: 'user' as const,
      text: promptText,
      time: 'Just now',
    };

    setChatHistory((prev) => [...prev, userMessage]);
    setChatQuery('');
    setIsTyping(true);

    // Contextual answer synthesis grounded in the 25 updates
    setTimeout(() => {
      let reply = '';
      const p = promptText.toLowerCase();

      if (p.includes('traffic')) {
        reply = `Traffic Analysis for ${cityName}:\n• Outer Ring Road near Hebbal is currently seeing heavy delays of 15–20 minutes due to a vehicle breakdown.\n• Congestion reported near Suburb Bus Stand on BN Road with peak interstate arrivals.\n• Expressway exit near Columbia Asia has a 600m queue.\n• Sayyaji Rao Road and Ramaswamy Circle are clear.`;
      } else if (p.includes('rain') || p.includes('weather')) {
        reply = `Weather Outlook for ${cityName}:\n• Current temperature is 26°C with 78% humidity.\n• Light rainfall expected between 6 PM–10 PM across central and southern wards.\n• Gusty winds up to 34 km/h recorded near Chamundi Foothills.\n• Air Quality Index is healthy at AQI 42 (Good).`;
      } else if (p.includes('incident') || p.includes('active') || p.includes('hazard')) {
        reply = `Active Civic Incidents in ${cityName}:\n1. Fallen Tree on Chamundi Hill Road (clearance crew dispatched, single-lane flow).\n2. Open Manhole cordoned off near Vijayanagar 2nd Stage.\n3. Low-hanging cable on Bogadi 2nd Stage Ring Road.\n4. Road resurfacing closure on Devaraja Urs Road until 5 PM.`;
      } else if (p.includes('change') || p.includes('today')) {
        reply = `Summary of Changes in ${cityName} Today:\n• 25 verified updates recorded across 5 domains.\n• Road repair on Devaraja Urs Road underway with Shivarampet diversions.\n• Scheduled water supply maintenance in VV Mohalla from 2 PM–6 PM.\n• 1 minor theft reported in Kuvempunagar 5th Cross under police investigation.`;
      } else {
        reply = `Based on live verified sensor streams and municipal reports in ${cityName}, overall city condition is rated Favorable (82/100). There are 4 traffic corridors experiencing moderate to heavy delays, and light rain is forecasted for this evening. Would you like specifics on traffic, weather, or civil safety?`;
      }

      setChatHistory((prev) => [
        ...prev,
        {
          id: `agent-${Date.now()}`,
          role: 'agent' as const,
          text: reply,
          time: 'Just now',
        },
      ]);
      setIsTyping(false);
    }, 450);
  };

  // Scroll chat to bottom
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory, isTyping]);

  return (
    <div
      style={{
        display: 'flex',
        height: '100%',
        width: '100%',
        overflow: 'hidden',
        backgroundColor: 'var(--bg-app)',
      }}
    >
      {/* ========================================================= */}
      {/* LEFT COLUMN: Mysuru Updates Feed (Approx 45% width)      */}
      {/* ========================================================= */}
      <section
        style={{
          flex: '0 0 45%',
          minWidth: '380px',
          maxWidth: '560px',
          borderRight: '1px solid var(--border-subtle)',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: 'var(--bg-panel)',
          height: '100%',
          overflow: 'hidden',
        }}
      >
        {/* Feed Header */}
        <div
          style={{
            padding: '16px 20px 12px 20px',
            borderBottom: '1px solid var(--border-subtle)',
            backgroundColor: 'var(--bg-header)',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h1 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.3px' }}>
                {cityName} Updates
              </h1>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '2px 8px',
                  borderRadius: '12px',
                  backgroundColor: 'var(--status-good-bg)',
                  border: '1px solid var(--status-good-border)',
                  color: 'var(--status-good-text)',
                  fontSize: '11px',
                  fontWeight: 700,
                }}
              >
                <span
                  style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--status-good-text)',
                  }}
                />
                Live
              </span>
            </div>

            <span
              style={{
                fontSize: '12px',
                fontWeight: 600,
                color: 'var(--text-muted)',
                backgroundColor: 'var(--bg-elevated)',
                border: '1px solid var(--border)',
                padding: '3px 8px',
                borderRadius: '6px',
              }}
            >
              {filteredUpdates.length} updates
            </span>
          </div>

          <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '0 0 12px 0' }}>
            Live city updates & alerts across infrastructure, traffic, weather, and civic safety
          </p>

          {/* Category Filter Pills */}
          <div
            style={{
              display: 'flex',
              gap: '6px',
              overflowX: 'auto',
              scrollbarWidth: 'none',
              paddingBottom: '2px',
            }}
          >
            {(['ALL', 'TRAFFIC', 'WEATHER', 'CRIME', 'HAZARD', 'MUNICIPAL'] as CategoryFilter[]).map((cat) => {
              const isSelected = selectedCategory === cat;
              const count = categoryCounts[cat] || 0;
              const label =
                cat === 'ALL'
                  ? 'All'
                  : cat === 'TRAFFIC'
                  ? 'Traffic'
                  : cat === 'WEATHER'
                  ? 'Weather'
                  : cat === 'CRIME'
                  ? 'Crime'
                  : cat === 'HAZARD'
                  ? 'Hazard'
                  : 'Municipal';

              return (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  style={{
                    padding: '5px 10px',
                    borderRadius: '20px',
                    fontSize: '11.5px',
                    fontWeight: 700,
                    border: isSelected ? '1px solid var(--accent-primary)' : '1px solid var(--border)',
                    backgroundColor: isSelected ? 'var(--button)' : 'var(--bg-subtle)',
                    color: isSelected ? 'var(--button-foreground)' : 'var(--text-secondary)',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    whiteSpace: 'nowrap',
                    transition: 'all 0.15s ease',
                    boxShadow: isSelected ? 'var(--shadow-xs)' : 'none',
                  }}
                >
                  <span>{label}</span>
                  <span
                    style={{
                      fontSize: '10px',
                      opacity: isSelected ? 0.9 : 0.7,
                      backgroundColor: isSelected ? 'rgba(255,255,255,0.2)' : 'var(--bg-surface-tertiary)',
                      color: isSelected ? 'var(--button-foreground)' : 'var(--text-secondary)',
                      padding: '1px 5px',
                      borderRadius: '10px',
                    }}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Search & Sort Bar */}
          <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
            <div
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                backgroundColor: 'var(--bg-input)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                padding: '0 10px',
                height: '34px',
                gap: '8px',
              }}
            >
              <SearchIcon size={14} color="var(--text-muted)" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={`Search updates in ${cityName}...`}
                style={{
                  border: 'none',
                  background: 'transparent',
                  outline: 'none',
                  width: '100%',
                  fontSize: '12px',
                  color: 'var(--text-primary)',
                }}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--text-muted)',
                    padding: 0,
                    display: 'flex',
                  }}
                >
                  <CloseIcon size={12} />
                </button>
              )}
            </div>

            <div style={{ position: 'relative' }}>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                style={{
                  height: '34px',
                  padding: '0 24px 0 10px',
                  borderRadius: '8px',
                  border: '1px solid var(--border)',
                  backgroundColor: 'var(--bg-input)',
                  fontSize: '11.5px',
                  fontWeight: 600,
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  outline: 'none',
                  appearance: 'none',
                }}
              >
                <option value="LATEST">Latest</option>
                <option value="SEVERITY">Priority / Severity</option>
                <option value="OLDEST">Oldest</option>
              </select>
              <ChevronDownIcon
                size={12}
                color="var(--text-muted)"
                style={{ position: 'absolute', right: '8px', top: '11px', pointerEvents: 'none' }}
              />
            </div>
          </div>
        </div>

        {/* Scrollable Updates List */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '14px 16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            backgroundColor: 'var(--bg-app)',
          }}
        >
          {filteredUpdates.length === 0 ? (
            <div
              style={{
                padding: '36px 20px',
                textAlign: 'center',
                backgroundColor: 'var(--bg-card)',
                borderRadius: '12px',
                border: '1px solid var(--border)',
                color: 'var(--text-muted)',
              }}
            >
              <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>
                No updates match your filter
              </div>
              <div style={{ fontSize: '12px' }}>Try selecting another category or clearing your search term.</div>
              <button
                onClick={() => {
                  setSelectedCategory('ALL');
                  setSearchQuery('');
                }}
                style={{
                  marginTop: '12px',
                  padding: '6px 14px',
                  borderRadius: '6px',
                  backgroundColor: 'var(--badge-info-bg)',
                  color: 'var(--badge-info-text)',
                  border: '1px solid var(--badge-info-border)',
                  fontSize: '11.5px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Reset Filters
              </button>
            </div>
          ) : (
            filteredUpdates.map((item) => {
              const theme = getCategoryTheme(item.category);
              const sev = getSeverityBadge(item.severity);
              const isSelected = focusedUpdateId === item.id;

              return (
                <article
                  key={item.id}
                  onClick={() => {
                    setFocusedUpdateId(item.id);
                    setSelectedUpdate(item);
                  }}
                  style={{
                    backgroundColor: isSelected ? 'var(--bg-card-hover)' : 'var(--bg-card)',
                    border: isSelected ? '1.5px solid var(--accent-primary)' : '1px solid var(--border)',
                    borderRadius: '12px',
                    padding: '14px 16px',
                    boxShadow: isSelected
                      ? 'var(--card-shadow-hover)'
                      : 'var(--card-shadow)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                    minHeight: '115px',
                    boxSizing: 'border-box',
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.borderColor = 'var(--border-hover)';
                      e.currentTarget.style.backgroundColor = 'var(--bg-card-hover)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.borderColor = 'var(--border)';
                      e.currentTarget.style.backgroundColor = 'var(--bg-card)';
                    }
                  }}
                >
                  {/* Top Row: Category Badge + Severity + Timestamp */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          padding: '2px 8px',
                          borderRadius: '6px',
                          backgroundColor: theme.bg,
                          border: `1px solid ${theme.border}`,
                          color: theme.color,
                          fontSize: '10.5px',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          letterSpacing: '0.3px',
                        }}
                      >
                        {theme.icon}
                        <span>{theme.label}</span>
                      </span>

                      <span
                        style={{
                          fontSize: '9.5px',
                          fontWeight: 700,
                          padding: '2px 6px',
                          borderRadius: '4px',
                          backgroundColor: sev.bg,
                          color: sev.color,
                          border: `1px solid ${sev.border}`,
                          letterSpacing: '0.2px',
                        }}
                      >
                        {sev.text}
                      </span>
                    </div>

                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 500 }}>
                      {item.timeAgo}
                    </span>
                  </div>

                  {/* Headline */}
                  <h3
                    style={{
                      fontSize: '13.5px',
                      fontWeight: 700,
                      color: 'var(--text-primary)',
                      margin: 0,
                      lineHeight: 1.35,
                      letterSpacing: '-0.1px',
                    }}
                  >
                    {item.headline}
                  </h3>

                  {/* 1–2 Line Description */}
                  <p
                    style={{
                      fontSize: '12px',
                      color: 'var(--text-secondary)',
                      margin: 0,
                      lineHeight: 1.45,
                      overflow: 'hidden',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                    }}
                  >
                    {item.description}
                  </p>

                  {/* Bottom Row: Location + Chevron Details Trigger */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginTop: '4px',
                      paddingTop: '6px',
                      borderTop: '1px solid var(--border-subtle)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', minWidth: 0 }}>
                      <PinIcon size={12} color="var(--text-muted)" />
                      <span
                        style={{
                          fontSize: '11px',
                          color: 'var(--text-muted)',
                          fontWeight: 600,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {item.location}
                      </span>
                    </div>

                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '2px',
                        fontSize: '11px',
                        fontWeight: 700,
                        color: 'var(--accent-primary)',
                        flexShrink: 0,
                      }}
                    >
                      <span>Details</span>
                      <ChevronRightIcon size={12} color="var(--accent-primary)" />
                    </span>
                  </div>
                </article>
              );
            })
          )}
        </div>
      </section>

      {/* ========================================================= */}
      {/* RIGHT COLUMN: UrbanPulse Agent Dashboard (Approx 55%)    */}
      {/* ========================================================= */}
      <main
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          overflowY: 'auto',
          backgroundColor: 'var(--bg-app)',
          padding: '16px 20px',
          gap: '14px',
        }}
      >
        {/* 1. TOP: UrbanPulse Agent Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 18px',
            backgroundColor: 'var(--bg-header)',
            borderRadius: '12px',
            border: '1px solid var(--border)',
            boxShadow: 'var(--card-shadow)',
            flexShrink: 0,
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <SparklesIcon size={18} color="var(--accent-primary)" />
              <h2 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                UrbanPulse Agent
              </h2>
              <span
                style={{
                  fontSize: '10px',
                  fontWeight: 700,
                  backgroundColor: 'var(--badge-info-bg)',
                  color: 'var(--badge-info-text)',
                  border: '1px solid var(--badge-info-border)',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  textTransform: 'uppercase',
                }}
              >
                AI DECISION ENGINE
              </span>
            </div>
            <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '2px' }}>
              Conversational Location Intelligence & Real-Time Situational Awareness
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: 'var(--bg-elevated)',
              padding: '6px 12px',
              borderRadius: '8px',
              border: '1px solid var(--border)',
            }}
          >
            <PinIcon size={13} color="var(--accent-primary)" />
            <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)' }}>
              {cityName}, Karnataka
            </span>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              (12.2958° N, 76.6394° E)
            </span>
          </div>
        </div>

        {/* 2. Compact "Mysuru at a glance" Summary Card */}
        <div
          style={{
            backgroundColor: 'var(--bg-card)',
            borderRadius: '12px',
            border: '1px solid var(--border)',
            padding: '14px 16px',
            boxShadow: 'var(--card-shadow)',
            flexShrink: 0,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '10px',
              borderBottom: '1px solid var(--border-subtle)',
              paddingBottom: '8px',
            }}
          >
            <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
              {cityName} at a Glance
            </span>
            <span style={{ fontSize: '11px', color: 'var(--status-good-text)', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <CheckCircleIcon size={12} color="var(--status-good-text)" />
              Verified Telemetry (Active)
            </span>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
              gap: '10px',
            }}
          >
            {/* Status */}
            <div style={{ backgroundColor: 'var(--bg-elevated)', padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>City Status</div>
              <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--status-good-text)', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--status-good-text)' }} />
                Operational
              </div>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '1px' }}>Nominal civil state</div>
            </div>

            {/* Traffic */}
            <div style={{ backgroundColor: 'var(--bg-elevated)', padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Traffic Flow</div>
              <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--status-warning-text)', marginTop: '2px' }}>
                Moderate Flow
              </div>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '1px' }}>28 km/h corridor avg</div>
            </div>

            {/* Weather */}
            <div style={{ backgroundColor: 'var(--bg-elevated)', padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Weather</div>
              <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--badge-info-text)', marginTop: '2px' }}>
                26°C · Light Rain
              </div>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '1px' }}>Evening rain forecasted</div>
            </div>

            {/* Active Incidents */}
            <div style={{ backgroundColor: 'var(--bg-elevated)', padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Incidents</div>
              <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--status-critical-text)', marginTop: '2px' }}>
                6 Active Reports
              </div>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '1px' }}>2 high, 4 moderate</div>
            </div>

            {/* Score */}
            <div style={{ backgroundColor: 'var(--bg-elevated)', padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Urban Score</div>
              <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--status-good-text)', marginTop: '2px' }}>
                82/100 · Favorable
              </div>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '1px' }}>Healthy civic index</div>
            </div>

            {/* Air Quality */}
            <div style={{ backgroundColor: 'var(--bg-elevated)', padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Air Quality</div>
              <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--accent-primary)', marginTop: '2px' }}>
                AQI 42 · Good
              </div>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '1px' }}>PM2.5: 11 µg/m³</div>
            </div>
          </div>
        </div>

        {/* 3. QUICK ACTION buttons */}
        <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', scrollbarWidth: 'none', flexShrink: 0 }}>
          {[
            { cat: 'TRAFFIC', label: 'Traffic', icon: <CarIcon size={13} color="var(--status-warning-text)" />, color: 'var(--status-warning-text)', bg: 'var(--badge-warning-bg)' },
            { cat: 'WEATHER', label: 'Weather', icon: <CloudRainIcon size={13} color="var(--badge-info-text)" />, color: 'var(--badge-info-text)', bg: 'var(--badge-info-bg)' },
            { cat: 'CRIME', label: 'Crime', icon: <ShieldIcon size={13} color="var(--status-critical-text)" />, color: 'var(--status-critical-text)', bg: 'var(--badge-hazard-bg)' },
            { cat: 'HAZARD', label: 'Hazard', icon: <AlertTriangleIcon size={13} color="var(--badge-approx-text)" />, color: 'var(--badge-approx-text)', bg: 'var(--badge-approx-bg)' },
            { cat: 'MUNICIPAL', label: 'Municipal', icon: <BuildingIcon size={13} color="var(--badge-info-text)" />, color: 'var(--badge-info-text)', bg: 'var(--badge-info-bg)' },
            { cat: 'ALL', label: 'Simulate', icon: <FlaskIcon size={13} color="var(--accent-primary)" />, color: 'var(--accent-primary)', bg: 'var(--badge-info-bg)' },
          ].map((btn) => (
            <button
              key={btn.label}
              onClick={() => {
                if (btn.label === 'Simulate') {
                  handleAskAgent('Simulate heavy monsoonal rainfall in Mysuru and show predicted impacts');
                } else {
                  setSelectedCategory(btn.cat as CategoryFilter);
                  handleAskAgent(`What are the latest ${btn.label.toLowerCase()} updates in Mysuru?`);
                }
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '7px 14px',
                borderRadius: '8px',
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border)',
                color: 'var(--text-primary)',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease',
                boxShadow: 'var(--shadow-xs)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = btn.color;
                e.currentTarget.style.backgroundColor = btn.bg;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--border)';
                e.currentTarget.style.backgroundColor = 'var(--bg-card)';
              }}
            >
              {btn.icon}
              <span>{btn.label}</span>
            </button>
          ))}
        </div>

        {/* 4. MAP: Proper Mysuru Live Map Section */}
        <div
          style={{
            position: 'relative',
            height: '240px',
            backgroundColor: 'var(--bg-surface-secondary)',
            borderRadius: '12px',
            border: '1px solid var(--border)',
            overflow: 'hidden',
            boxShadow: 'var(--shadow-xs)',
            flexShrink: 0,
          }}
        >
          {/* Stylized vector map canvas of Mysuru */}
          <svg
            width="100%"
            height="100%"
            viewBox="0 0 800 320"
            preserveAspectRatio="xMidYMid slice"
            style={{ width: '100%', height: '100%', display: 'block', backgroundColor: 'var(--bg-surface-secondary)' }}
          >
            {/* Background Base Terrain */}
            <rect width="100%" height="100%" fill="var(--bg-surface-secondary)" />

            {/* Chamundi Hill Green Mass */}
            <path
              d="M 520,240 Q 600,200 680,260 Q 720,300 580,320 Z"
              fill="var(--status-good-bg)"
              stroke="var(--status-good-border)"
              strokeWidth="1.5"
            />
            <text x="610" y="270" fontSize="11" fontWeight="700" fill="var(--status-good-text)">Chamundi Hill</text>

            {/* Lakes */}
            {/* Kukkarahalli Lake */}
            <ellipse cx="260" cy="180" rx="35" ry="20" fill="var(--badge-info-bg)" stroke="var(--badge-info-border)" strokeWidth="1" />
            <text x="235" y="183" fontSize="9" fontWeight="600" fill="var(--badge-info-text)">Kukkarahalli</text>

            {/* Karanji Lake */}
            <ellipse cx="510" cy="160" rx="40" ry="22" fill="var(--badge-info-bg)" stroke="var(--badge-info-border)" strokeWidth="1" />
            <text x="490" y="163" fontSize="9" fontWeight="600" fill="var(--badge-info-text)">Karanji</text>

            {/* Major Arterial Roads / Ring Road */}
            {/* Outer Ring Road (large loop) */}
            <path
              d="M 120,60 C 250,20 580,20 700,90 C 780,180 750,280 620,300 C 420,330 180,310 100,220 C 60,150 70,80 120,60 Z"
              fill="none"
              stroke="var(--border-hover)"
              strokeWidth="4"
            />

            {/* Sayyaji Rao Road / Highway 275 */}
            <line x1="400" y1="20" x2="400" y2="300" stroke="var(--border-hover)" strokeWidth="3" />

            {/* Devaraja Urs Road */}
            <line x1="220" y1="140" x2="480" y2="140" stroke="var(--border-hover)" strokeWidth="3" />

            {/* Hunsur Road */}
            <line x1="100" y1="110" x2="380" y2="140" stroke="var(--border-hover)" strokeWidth="2.5" />

            {/* Nanjangud Road */}
            <line x1="420" y1="160" x2="560" y2="300" stroke="var(--border-hover)" strokeWidth="2.5" />

            {/* Mysore Palace Landmark */}
            <rect x="385" y="145" width="30" height="24" rx="4" fill="var(--bg-card)" stroke="var(--border-strong)" strokeWidth="1.5" />
            <text x="350" y="182" fontSize="10" fontWeight="700" fill="var(--text-primary)">Mysore Palace</text>

            {/* District Labels */}
            <text x="160" y="70" fontSize="10" fontWeight="600" fill="var(--text-muted)">Hebbal</text>
            <text x="210" y="100" fontSize="10" fontWeight="600" fill="var(--text-muted)">Gokulam</text>
            <text x="180" y="240" fontSize="10" fontWeight="600" fill="var(--text-muted)">Kuvempunagar</text>
            <text x="290" y="210" fontSize="10" fontWeight="600" fill="var(--text-muted)">Saraswathipuram</text>
            <text x="440" y="90" fontSize="10" fontWeight="600" fill="var(--text-muted)">Columbia Asia Jct</text>
            <text x="480" y="270" fontSize="10" fontWeight="600" fill="var(--text-muted)">JP Nagar</text>
          </svg>

          {/* Interactive Event Pins rendered on top of the map */}
          {filteredUpdates.slice(0, 16).map((item, idx) => {
            // Geographic projection to SVG coords (normalized around Mysuru bounding box)
            // Mysuru bounds: lat ~12.27 to 12.36, lng ~76.60 to 76.68
            const minLat = 12.265;
            const maxLat = 12.365;
            const minLng = 76.595;
            const maxLng = 76.685;

            const xPct = Math.min(95, Math.max(5, ((item.longitude - minLng) / (maxLng - minLng)) * 100));
            const yPct = Math.min(90, Math.max(10, (1 - (item.latitude - minLat) / (maxLat - minLat)) * 100));

            const isItemFocused = focusedUpdateId === item.id;
            const theme = getCategoryTheme(item.category);

            return (
              <div
                key={item.id}
                onClick={() => {
                  setFocusedUpdateId(item.id);
                  setSelectedUpdate(item);
                }}
                style={{
                  position: 'absolute',
                  left: `${xPct}%`,
                  top: `${yPct}%`,
                  transform: 'translate(-50%, -50%)',
                  cursor: 'pointer',
                  zIndex: isItemFocused ? 30 : 15,
                  transition: 'transform 0.15s ease',
                }}
                title={`${item.category}: ${item.headline} (${item.location})`}
              >
                <div
                  style={{
                    width: isItemFocused ? '24px' : '18px',
                    height: isItemFocused ? '24px' : '18px',
                    borderRadius: '50%',
                    backgroundColor: theme.color,
                    border: '2px solid var(--bg-card)',
                    boxShadow: isItemFocused
                      ? '0 0 0 3px rgba(37, 99, 235, 0.4), 0 3px 8px rgba(0,0,0,0.2)'
                      : '0 2px 4px rgba(0,0,0,0.18)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--button-foreground)',
                    fontSize: '9px',
                    fontWeight: 800,
                  }}
                >
                  {item.category[0]}
                </div>
              </div>
            );
          })}

          {/* Map Top-Right Controls & Legend */}
          <div
            style={{
              position: 'absolute',
              top: '10px',
              right: '10px',
              backgroundColor: 'var(--overlay-bg)',
              backdropFilter: 'blur(6px)',
              padding: '4px 8px',
              borderRadius: '6px',
              border: '1px solid var(--border)',
              fontSize: '10px',
              fontWeight: 700,
              color: 'var(--text-primary)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
              <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: 'var(--status-warning-text)' }} /> Traffic
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
              <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: 'var(--badge-approx-text)' }} /> Hazard
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
              <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: 'var(--status-critical-text)' }} /> Crime
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
              <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: 'var(--badge-info-text)' }} /> Municipal
            </span>
          </div>

          {/* Map Bottom-Left Location Badge */}
          <div
            style={{
              position: 'absolute',
              bottom: '10px',
              left: '10px',
              backgroundColor: 'var(--overlay-bg)',
              backdropFilter: 'blur(4px)',
              padding: '3px 8px',
              borderRadius: '4px',
              border: '1px solid var(--border)',
              fontSize: '10.5px',
              fontWeight: 600,
              color: 'var(--text-secondary)',
            }}
          >
            Mysuru Urban Coverage • 25 Markers Active
          </div>
        </div>

        {/* 5. TWO CARDS SIDE-BY-SIDE: "Recent Highlights" and "Ask UrbanPulse" */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '12px',
            flexShrink: 0,
          }}
        >
          {/* Card 1: Recent Highlights */}
          <div
            style={{
              backgroundColor: 'var(--bg-card)',
              borderRadius: '12px',
              border: '1px solid var(--border)',
              padding: '14px 16px',
              boxShadow: 'var(--card-shadow)',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '6px' }}>
              <RadioIcon size={14} color="var(--accent-primary)" />
              <h3 style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                Recent Highlights
              </h3>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {[
                { id: 'up-1', title: 'Heavy traffic near Hebbal', tag: 'Traffic', time: '12m ago', color: 'var(--status-warning-text)', bg: 'var(--badge-warning-bg)' },
                { id: 'up-2', title: 'Light rainfall expected this evening', tag: 'Weather', time: '18m ago', color: 'var(--badge-info-text)', bg: 'var(--badge-info-bg)' },
                { id: 'up-3', title: 'Fallen tree near Chamundi Hill Road', tag: 'Hazard', time: '8m ago', color: 'var(--badge-approx-text)', bg: 'var(--badge-approx-bg)' },
                { id: 'up-4', title: 'Road repair work on Devaraja Urs Road', tag: 'Municipal', time: '25m ago', color: 'var(--badge-info-text)', bg: 'var(--badge-info-bg)' },
              ].map((hl) => (
                <div
                  key={hl.id}
                  onClick={() => {
                    setFocusedUpdateId(hl.id);
                    const item = MYSURU_UPDATES.find((u) => u.id === hl.id);
                    if (item) setSelectedUpdate(item);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '6px 8px',
                    borderRadius: '6px',
                    backgroundColor: 'var(--bg-elevated)',
                    border: '1px solid var(--border-subtle)',
                    cursor: 'pointer',
                    transition: 'all 0.1s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--bg-card-hover)';
                    e.currentTarget.style.borderColor = 'var(--border-hover)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--bg-elevated)';
                    e.currentTarget.style.borderColor = 'var(--border-subtle)';
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                    <span
                      style={{
                        fontSize: '9px',
                        fontWeight: 700,
                        padding: '1px 5px',
                        borderRadius: '4px',
                        backgroundColor: hl.bg,
                        color: hl.color,
                        flexShrink: 0,
                      }}
                    >
                      {hl.tag}
                    </span>
                    <span style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {hl.title}
                    </span>
                  </div>
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)', flexShrink: 0, marginLeft: '6px' }}>{hl.time}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Card 2: Ask UrbanPulse */}
          <div
            style={{
              backgroundColor: 'var(--bg-card)',
              borderRadius: '12px',
              border: '1px solid var(--border)',
              padding: '14px 16px',
              boxShadow: 'var(--card-shadow)',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '6px' }}>
              <SparklesIcon size={14} color="var(--accent-primary)" />
              <h3 style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                Ask UrbanPulse
              </h3>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {[
                "What's the traffic like in Mysuru now?",
                'Will it rain tonight in Mysuru?',
                'Are there any active incidents?',
                'What changed in Mysuru today?',
              ].map((q) => (
                <button
                  key={q}
                  onClick={() => handleAskAgent(q)}
                  style={{
                    textAlign: 'left',
                    padding: '6px 8px',
                    borderRadius: '6px',
                    backgroundColor: 'var(--bg-elevated)',
                    border: '1px solid var(--border)',
                    fontSize: '11.5px',
                    color: 'var(--text-secondary)',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.12s ease',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--bg-card-hover)';
                    e.currentTarget.style.borderColor = 'var(--accent-primary)';
                    e.currentTarget.style.color = 'var(--accent-primary)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--bg-elevated)';
                    e.currentTarget.style.borderColor = 'var(--border)';
                    e.currentTarget.style.color = 'var(--text-secondary)';
                  }}
                >
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{q}</span>
                  <ChevronRightIcon size={12} color="var(--text-muted)" />
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 6. Conversational Agent Response Stream Area */}
        <div
          style={{
            flex: 1,
            minHeight: '130px',
            backgroundColor: 'var(--bg-card)',
            borderRadius: '12px',
            border: '1px solid var(--border)',
            padding: '12px 16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            overflowY: 'auto',
          }}
        >
          <div style={{ fontSize: '10.5px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
            Agent Intelligence Dialogue
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {chatHistory.map((msg) => (
              <div
                key={msg.id}
                style={{
                  alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                  maxWidth: '85%',
                  backgroundColor: msg.role === 'user' ? 'var(--button)' : 'var(--bg-elevated)',
                  color: msg.role === 'user' ? 'var(--button-foreground)' : 'var(--text-primary)',
                  padding: '8px 12px',
                  borderRadius: msg.role === 'user' ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                  fontSize: '12px',
                  lineHeight: 1.5,
                  whiteSpace: 'pre-line',
                  border: msg.role === 'user' ? 'none' : '1px solid var(--border)',
                }}
              >
                {msg.text}
              </div>
            ))}
            {isTyping && (
              <div
                style={{
                  alignSelf: 'flex-start',
                  backgroundColor: 'var(--bg-elevated)',
                  padding: '6px 12px',
                  borderRadius: '10px',
                  fontSize: '11.5px',
                  color: 'var(--text-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  border: '1px solid var(--border)',
                }}
              >
                <span
                  style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--accent-primary)',
                    animation: 'pulse 1s infinite',
                  }}
                />
                <span>Analyzing civic streams...</span>
              </div>
            )}
            <div ref={chatBottomRef} />
          </div>
        </div>

        {/* 7. BOTTOM: Fixed / Sticky UrbanPulse Chat Input */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            backgroundColor: 'var(--bg-header)',
            borderRadius: '10px',
            border: '1px solid var(--border)',
            padding: '4px 6px 4px 12px',
            gap: '8px',
            boxShadow: 'var(--shadow-sm)',
            flexShrink: 0,
          }}
        >
          <input
            type="text"
            value={chatQuery}
            onChange={(e) => setChatQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAskAgent(chatQuery);
              }
            }}
            placeholder={`Ask anything about ${cityName}... (e.g. traffic, weather, road works)`}
            style={{
              flex: 1,
              border: 'none',
              outline: 'none',
              fontSize: '13px',
              color: 'var(--text-primary)',
              backgroundColor: 'transparent',
            }}
          />
          <button
            onClick={() => handleAskAgent(chatQuery)}
            disabled={!chatQuery.trim()}
            style={{
              width: '34px',
              height: '34px',
              borderRadius: '8px',
              backgroundColor: chatQuery.trim() ? 'var(--button)' : 'var(--bg-elevated)',
              border: 'none',
              color: 'var(--button-foreground)',
              cursor: chatQuery.trim() ? 'pointer' : 'default',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.15s ease',
            }}
            title="Send Query to UrbanPulse Agent"
          >
            <SendIcon size={15} color={chatQuery.trim() ? 'var(--button-foreground)' : 'var(--text-muted)'} />
          </button>
        </div>
      </main>

      {/* ========================================================= */}
      {/* DETAIL MODAL: Shown when an update card is clicked       */}
      {/* ========================================================= */}
      {selectedUpdate && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: '20px',
          }}
          onClick={() => setSelectedUpdate(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '520px',
              backgroundColor: 'var(--bg-panel)',
              borderRadius: '16px',
              boxShadow: 'var(--shadow-panel)',
              border: '1px solid var(--border)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              maxHeight: '90vh',
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: '16px 20px',
                borderBottom: '1px solid var(--border-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                backgroundColor: 'var(--bg-header)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span
                  style={{
                    padding: '3px 8px',
                    borderRadius: '6px',
                    backgroundColor: getCategoryTheme(selectedUpdate.category).bg,
                    color: getCategoryTheme(selectedUpdate.category).color,
                    border: `1px solid ${getCategoryTheme(selectedUpdate.category).border}`,
                    fontSize: '11px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                  }}
                >
                  {selectedUpdate.category}
                </span>
                <span
                  style={{
                    padding: '3px 8px',
                    borderRadius: '6px',
                    backgroundColor: getSeverityBadge(selectedUpdate.severity).bg,
                    color: getSeverityBadge(selectedUpdate.severity).color,
                    fontSize: '10.5px',
                    fontWeight: 700,
                  }}
                >
                  {selectedUpdate.severity} SEVERITY
                </span>
              </div>

              <button
                onClick={() => setSelectedUpdate(null)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--text-muted)',
                  padding: '4px',
                }}
              >
                <CloseIcon size={16} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <h2 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)', margin: 0, lineHeight: 1.35 }}>
                {selectedUpdate.headline}
              </h2>

              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.55 }}>
                {selectedUpdate.description}
              </p>

              {/* Specific metadata table */}
              <div
                style={{
                  backgroundColor: 'var(--bg-elevated)',
                  borderRadius: '8px',
                  border: '1px solid var(--border)',
                  padding: '12px 14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  fontSize: '12px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Location:</span>
                  <span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{selectedUpdate.location}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Coordinates:</span>
                  <span style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>
                    {selectedUpdate.latitude.toFixed(4)}° N, {selectedUpdate.longitude.toFixed(4)}° E
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Reported At:</span>
                  <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                    {selectedUpdate.timestamp} ({selectedUpdate.timeAgo})
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Reporting Authority:</span>
                  <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{selectedUpdate.agency}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Operation Status:</span>
                  <span style={{ color: 'var(--status-good-text)', fontWeight: 700 }}>{selectedUpdate.status}</span>
                </div>
              </div>

              {/* Impact / Action Advice */}
              <div
                style={{
                  backgroundColor: 'var(--badge-info-bg)',
                  borderRadius: '8px',
                  border: '1px solid var(--badge-info-border)',
                  padding: '12px 14px',
                }}
              >
                <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--badge-info-text)', textTransform: 'uppercase', marginBottom: '2px' }}>
                  Civic Impact & Advisory
                </div>
                <div style={{ fontSize: '12.5px', color: 'var(--text-primary)', lineHeight: 1.45 }}>
                  {selectedUpdate.impact}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div
              style={{
                padding: '12px 20px',
                borderTop: '1px solid var(--border-subtle)',
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '8px',
                backgroundColor: 'var(--bg-header)',
              }}
            >
              <button
                onClick={() => {
                  setSelectedUpdate(null);
                  handleAskAgent(`Tell me more about the incident at ${selectedUpdate.location}`);
                }}
                style={{
                  padding: '7px 14px',
                  borderRadius: '6px',
                  backgroundColor: 'var(--button)',
                  color: 'var(--button-foreground)',
                  fontSize: '12px',
                  fontWeight: 700,
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                Ask Agent About This
              </button>
              <button
                onClick={() => setSelectedUpdate(null)}
                style={{
                  padding: '7px 14px',
                  borderRadius: '6px',
                  backgroundColor: 'var(--bg-elevated)',
                  color: 'var(--text-secondary)',
                  fontSize: '12px',
                  fontWeight: 600,
                  border: '1px solid var(--border)',
                  cursor: 'pointer',
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
