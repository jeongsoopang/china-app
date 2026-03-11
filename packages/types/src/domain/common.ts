export type EntityId = string;

export type Timestamp = string;

export type BaseEntity = {
  id: EntityId;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};
