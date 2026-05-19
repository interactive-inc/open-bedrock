"""会議室予約 API。"""
from datetime import datetime
from typing import List
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import and_

from ..db import get_db
from ..models import Room, RoomReservation, Employee
from ..schemas import (
    RoomOut, RoomAvailability, RoomReservationCreate, RoomReservationOut,
)
from ..deps import current_user

router = APIRouter(prefix="/rooms", tags=["rooms"])


@router.get("", response_model=List[RoomOut])
def list_rooms(db: Session = Depends(get_db), user: Employee = Depends(current_user)):
    return db.query(Room).order_by(Room.name).all()


@router.get("/availability", response_model=List[RoomAvailability])
def availability(
    start_at: datetime = Query(...),
    end_at: datetime = Query(...),
    capacity: int = 0,
    db: Session = Depends(get_db),
    user: Employee = Depends(current_user),
):
    if start_at >= end_at:
        raise HTTPException(400, "start_at must be < end_at")
    rooms = db.query(Room).filter(Room.capacity >= capacity).all()
    out = []
    for r in rooms:
        conflicts = db.query(RoomReservation).filter(
            RoomReservation.room_id == r.id,
            RoomReservation.start_at < end_at,
            RoomReservation.end_at > start_at,
        ).all()
        out.append(RoomAvailability(
            room=RoomOut.model_validate(r),
            available=not conflicts,
            conflicts=[
                {"id": c.id, "start_at": c.start_at.isoformat(), "end_at": c.end_at.isoformat(),
                 "purpose": c.purpose} for c in conflicts
            ],
        ))
    return out


@router.post("/reservations", response_model=RoomReservationOut)
def reserve(body: RoomReservationCreate, db: Session = Depends(get_db), user: Employee = Depends(current_user)):
    if body.start_at >= body.end_at:
        raise HTTPException(400, "start_at must be < end_at")
    room = db.get(Room, body.room_id)
    if not room:
        raise HTTPException(404, "room not found")
    conflict = db.query(RoomReservation).filter(
        RoomReservation.room_id == room.id,
        RoomReservation.start_at < body.end_at,
        RoomReservation.end_at > body.start_at,
    ).first()
    if conflict:
        raise HTTPException(409, "conflict with existing reservation")
    r = RoomReservation(
        room_id=room.id, user_id=user.id,
        start_at=body.start_at, end_at=body.end_at, purpose=body.purpose,
    )
    db.add(r)
    db.commit()
    db.refresh(r)
    return RoomReservationOut(
        id=r.id, room_id=r.room_id, room_name=room.name,
        user_id=user.id, user_name=user.name,
        start_at=r.start_at, end_at=r.end_at, purpose=r.purpose,
    )
