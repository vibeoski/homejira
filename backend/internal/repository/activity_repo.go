package repository

import (
	"context"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/homejira/api/internal/domain"
)

type activityRepo struct {
	db *pgxpool.Pool
}

func NewActivityRepository(db *pgxpool.Pool) domain.ActivityRepository {
	return &activityRepo{db: db}
}

func (r *activityRepo) Create(taskID uuid.UUID, actorID *uuid.UUID, kind domain.ActivityKind, meta map[string]string) (*domain.Activity, error) {
	ctx := context.Background()

	var metaJSON interface{}
	if len(meta) > 0 {
		metaJSON = meta
	}

	row := r.db.QueryRow(ctx, `
		INSERT INTO task_activities (task_id, actor_id, kind, meta)
		VALUES ($1, $2, $3, $4)
		RETURNING id, task_id, actor_id, kind, meta, created_at
	`, taskID, actorID, kind, metaJSON)

	return scanActivity(row)
}

func (r *activityRepo) FindByTask(taskID uuid.UUID) ([]domain.Activity, error) {
	ctx := context.Background()

	rows, err := r.db.Query(ctx, `
		SELECT
			a.id, a.task_id, a.actor_id, a.kind, a.meta, a.created_at,
			m.id, m.name, m.avatar, m.color, m.created_at
		FROM task_activities a
		LEFT JOIN members m ON m.id = a.actor_id
		WHERE a.task_id = $1
		ORDER BY a.created_at ASC
	`, taskID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var activities []domain.Activity
	for rows.Next() {
		var a domain.Activity
		var actor domain.Member
		var actorID *uuid.UUID
		var meta map[string]string
		var actorIDVal, actorName, actorAvatar, actorColor *string
		var actorCreatedAt *interface{}

		_ = actorCreatedAt
		err := rows.Scan(
			&a.ID, &a.TaskID, &actorID, &a.Kind, &meta, &a.CreatedAt,
			&actorIDVal, &actorName, &actorAvatar, &actorColor, &actorCreatedAt,
		)
		if err != nil {
			return nil, err
		}

		a.ActorID = actorID
		a.Meta = meta

		if actorIDVal != nil {
			id, _ := uuid.Parse(*actorIDVal)
			actor.ID = id
			actor.Name = ptrStr(actorName)
			actor.Avatar = ptrStr(actorAvatar)
			actor.Color = ptrStr(actorColor)
			a.Actor = &actor
		}

		activities = append(activities, a)
	}
	if activities == nil {
		activities = []domain.Activity{}
	}
	return activities, rows.Err()
}

func scanActivity(row interface{ Scan(...any) error }) (*domain.Activity, error) {
	var a domain.Activity
	var meta map[string]string
	err := row.Scan(&a.ID, &a.TaskID, &a.ActorID, &a.Kind, &meta, &a.CreatedAt)
	if err != nil {
		return nil, err
	}
	a.Meta = meta
	return &a, nil
}

func ptrStr(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}
