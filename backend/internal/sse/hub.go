package sse

import (
	"sync"

	"github.com/google/uuid"
)

// Hub manages SSE subscriber channels per household and per member.
type Hub struct {
	mu            sync.RWMutex
	households    map[uuid.UUID]map[chan struct{}]struct{}
	memberClients map[uuid.UUID]map[chan struct{}]struct{}
}

func NewHub() *Hub {
	return &Hub{
		households:    make(map[uuid.UUID]map[chan struct{}]struct{}),
		memberClients: make(map[uuid.UUID]map[chan struct{}]struct{}),
	}
}

// Subscribe registers a channel for a household and returns an unsubscribe func.
func (h *Hub) Subscribe(householdID uuid.UUID) (chan struct{}, func()) {
	return h.subscribe(h.households, householdID)
}

// SubscribeMember registers a channel for a specific member (used when not yet in a household).
func (h *Hub) SubscribeMember(memberID uuid.UUID) (chan struct{}, func()) {
	return h.subscribe(h.memberClients, memberID)
}

func (h *Hub) subscribe(m map[uuid.UUID]map[chan struct{}]struct{}, id uuid.UUID) (chan struct{}, func()) {
	ch := make(chan struct{}, 1)
	h.mu.Lock()
	if m[id] == nil {
		m[id] = make(map[chan struct{}]struct{})
	}
	m[id][ch] = struct{}{}
	h.mu.Unlock()
	return ch, func() {
		h.mu.Lock()
		delete(m[id], ch)
		if len(m[id]) == 0 {
			delete(m, id)
		}
		h.mu.Unlock()
	}
}

// Notify signals all subscribers of a household (non-blocking).
func (h *Hub) Notify(householdID uuid.UUID) {
	h.notify(h.households, householdID)
}

// NotifyMember signals a specific member's SSE stream (non-blocking).
func (h *Hub) NotifyMember(memberID uuid.UUID) {
	h.notify(h.memberClients, memberID)
}

func (h *Hub) notify(m map[uuid.UUID]map[chan struct{}]struct{}, id uuid.UUID) {
	h.mu.RLock()
	defer h.mu.RUnlock()
	for ch := range m[id] {
		select {
		case ch <- struct{}{}:
		default:
		}
	}
}
