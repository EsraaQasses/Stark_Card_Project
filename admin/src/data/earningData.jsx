import React from 'react';
import { MdOutlineLocalShipping, MdOutlinePendingActions, MdOutlineTrendingUp, MdOutlineReportProblem } from 'react-icons/md';


export const earningData = [
  {
    name: 'shipping-requests',
    icon: <MdOutlineLocalShipping />,
    amount: '1,234',
    title: 'Shipping Requests',
    iconColor: '#3B82F6',
    iconBg: '#DBEAFE',
  },
  {
    name: 'pending',
    icon: <MdOutlinePendingActions />,
    amount: '567',
    title: 'Pending',
    iconColor: '#F59E0B',
    iconBg: '#FEF3C7',
  },
  {
    name: 'in-progress',
    icon: <MdOutlineTrendingUp />,
    amount: '890',
    title: 'In Progress',
    iconColor: '#10B981',
    iconBg: '#D1FAE5',
  },
  {
    name: 'objection-requests',
    icon: <MdOutlineReportProblem />,
    amount: '321',
    title: 'Objection Requests',
    iconColor: '#EF4444',
    iconBg: '#FEE2E2',
  },
];
