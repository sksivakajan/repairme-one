import type { TicketData } from '@/components/ticketing';
export const ticketFixtures: TicketData = {
  tickets: [
    {
      id: 'fixture-ticket',
      ticket_number: 1001,
      requester_id: 'preview',
      assignee_id: null,
      title: 'Office printer is offline',
      description:
        'Fictional example: the printer in the meeting room cannot connect to the office network.',
      category: 'hardware',
      location: 'Meeting room',
      priority: 'high',
      status: 'open',
      version: 1,
      created_at: '2026-10-13T09:00:00Z',
      updated_at: '2026-10-13T09:00:00Z',
    },
  ],
  comments: [],
  events: [
    {
      id: 'fixture-ticket-event',
      ticket_id: 'fixture-ticket',
      actor_id: 'preview',
      event: 'created',
      details: {},
      created_at: '2026-10-13T09:00:00Z',
    },
  ],
};
