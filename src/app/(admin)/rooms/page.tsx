"use client";

import { useState } from "react";
import PageBreadCrumb from "@/components/common/PageBreadCrumb";
import Button from "@/components/ui/button/Button";
import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import SlidePanel from "@/components/ui/SlidePanel";
import {
  useRoomsList,
  useCreateRoom,
  useUpdateRoom,
  useDeleteRoom,
  type Room,
  type RoomType,
  type RoomStatus,
  type CreateRoomData,
} from "@/hooks/useRooms";

const roomTypes = [
  { value: "studio", label: "Studio" },
  { value: "outdoor", label: "Outdoor Area" },
  { value: "pool", label: "Pool (Aqua)" },
  { value: "gym", label: "Gym Floor" },
];

const amenityOptions = [
  "Mirrors",
  "Sound System",
  "Air Conditioning",
  "Wooden Floor",
  "Mats Provided",
  "Lockers",
  "Showers",
  "Water Fountain",
  "Projector",
  "Weights",
  "Resistance Bands",
  "Ballet Barre",
];

const colorOptions = [
  { value: "amber", label: "Amber", class: "bg-amber-500" },
  { value: "blue", label: "Blue", class: "bg-blue-500" },
  { value: "emerald", label: "Emerald", class: "bg-emerald-500" },
  { value: "purple", label: "Purple", class: "bg-purple-500" },
  { value: "rose", label: "Rose", class: "bg-rose-500" },
  { value: "cyan", label: "Cyan", class: "bg-cyan-500" },
];

type FormData = {
  name: string;
  capacity: number;
  type: RoomType;
  amenities: string[];
  status: RoomStatus;
  description: string;
  color: string;
};

const initialFormData: FormData = {
  name: "",
  capacity: 20,
  type: "studio",
  amenities: [],
  status: "available",
  description: "",
  color: "amber",
};

// Skeleton Components
const StatCardSkeleton = () => (
  <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800 animate-pulse">
    <div className="h-7 w-12 bg-gray-200 dark:bg-gray-700 rounded mb-1"></div>
    <div className="h-4 w-20 bg-gray-200 dark:bg-gray-700 rounded"></div>
  </div>
);

const RoomCardSkeleton = () => (
  <div className="rounded-2xl border-2 border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800 animate-pulse">
    <div className="flex items-start justify-between mb-4">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-gray-200 dark:bg-gray-700"></div>
        <div>
          <div className="h-5 w-32 bg-gray-200 dark:bg-gray-700 rounded mb-1"></div>
          <div className="h-4 w-20 bg-gray-200 dark:bg-gray-700 rounded"></div>
        </div>
      </div>
      <div className="h-6 w-20 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
    </div>
    <div className="space-y-3">
      <div className="flex gap-2">
        <div className="h-6 w-16 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
        <div className="h-6 w-20 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
        <div className="h-6 w-14 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
      </div>
      <div className="h-4 w-full bg-gray-200 dark:bg-gray-700 rounded"></div>
    </div>
    <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700 flex gap-2">
      <div className="h-8 w-16 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
      <div className="h-8 w-16 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
    </div>
  </div>
);

export default function RoomsPage() {
  const [filterType, setFilterType] = useState<string>("all");
  const [showPanel, setShowPanel] = useState(false);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [formData, setFormData] = useState<FormData>(initialFormData);

  // API hooks
  const { data, isLoading, error, refetch } = useRoomsList(filterType === "all" ? undefined : filterType);
  const createRoom = useCreateRoom();
  const updateRoom = useUpdateRoom();
  const deleteRoom = useDeleteRoom();

  const rooms = data?.rooms || [];
  const stats = data?.stats || { total: 0, available: 0, maintenance: 0, totalCapacity: 0 };

  const openCreatePanel = () => {
    setEditingRoom(null);
    setFormData(initialFormData);
    setShowPanel(true);
  };

  const openEditPanel = (room: Room) => {
    setEditingRoom(room);
    setFormData({
      name: room.name,
      capacity: room.capacity,
      type: room.type,
      amenities: room.amenities,
      status: room.status,
      description: room.description || "",
      color: room.color,
    });
    setShowPanel(true);
  };

  const handleSave = async () => {
    if (!formData.name) return;

    const roomData: CreateRoomData = {
      name: formData.name,
      capacity: formData.capacity,
      type: formData.type,
      amenities: formData.amenities,
      status: formData.status,
      description: formData.description,
      color: formData.color,
    };

    try {
      if (editingRoom) {
        await updateRoom.mutateAsync({ id: editingRoom.id, data: roomData });
      } else {
        await createRoom.mutateAsync(roomData);
      }
      setShowPanel(false);
      setFormData(initialFormData);
      setEditingRoom(null);
    } catch (err) {
      console.error("Failed to save room:", err);
      alert("Failed to save room. Please try again.");
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this room?")) {
      try {
        await deleteRoom.mutateAsync(id);
      } catch (err) {
        console.error("Failed to delete room:", err);
        alert("Failed to delete room. Please try again.");
      }
    }
  };

  const toggleAmenity = (amenity: string) => {
    setFormData(prev => ({
      ...prev,
      amenities: prev.amenities?.includes(amenity)
        ? prev.amenities.filter(a => a !== amenity)
        : [...(prev.amenities || []), amenity],
    }));
  };

  // Count rooms by type for filter buttons
  const getRoomTypeCount = (type: string) => {
    if (type === "all") return rooms.length;
    return rooms.filter(r => r.type === type).length;
  };

  const getColorClass = (color: string, type: "bg" | "text" | "border") => {
    const colors: Record<string, Record<string, string>> = {
      amber: { bg: "bg-amber-500", text: "text-amber-600", border: "border-amber-500" },
      blue: { bg: "bg-blue-500", text: "text-blue-600", border: "border-blue-500" },
      emerald: { bg: "bg-emerald-500", text: "text-emerald-600", border: "border-emerald-500" },
      purple: { bg: "bg-purple-500", text: "text-purple-600", border: "border-purple-500" },
      rose: { bg: "bg-rose-500", text: "text-rose-600", border: "border-rose-500" },
      cyan: { bg: "bg-cyan-500", text: "text-cyan-600", border: "border-cyan-500" },
    };
    return colors[color]?.[type] || colors.amber[type];
  };

  // Loading State with Skeleton
  if (isLoading) {
    return (
      <div>
        <PageBreadCrumb pageTitle="Rooms & Studios" />

        {/* Stats Skeleton */}
        <div className="grid grid-cols-2 gap-4 mb-6 sm:grid-cols-4">
          {[...Array(4)].map((_, i) => <StatCardSkeleton key={i} />)}
        </div>

        {/* Header Actions Skeleton */}
        <div className="flex flex-col gap-4 mb-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-2 animate-pulse">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-10 w-20 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
            ))}
          </div>
          <div className="h-10 w-32 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse"></div>
        </div>

        {/* Rooms Grid Skeleton */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => <RoomCardSkeleton key={i} />)}
        </div>
      </div>
    );
  }

  // Error State
  if (error) {
    return (
      <div>
        <PageBreadCrumb pageTitle="Rooms & Studios" />
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="text-red-500 mb-4">
            <svg className="h-16 w-16 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Failed to load rooms</h3>
          <p className="text-gray-500 dark:text-gray-400 mb-4">{error.message}</p>
          <Button onClick={() => refetch()}>Try Again</Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageBreadCrumb pageTitle="Rooms & Studios" />

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 mb-6 sm:grid-cols-4">
        <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.total}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">Total Rooms</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <p className="text-2xl font-bold text-emerald-600">{stats.available}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">Available</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <p className="text-2xl font-bold text-amber-600">{stats.maintenance}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">In Maintenance</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <p className="text-2xl font-bold text-blue-600">{stats.totalCapacity}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">Total Capacity</p>
        </div>
      </div>

      {/* Header Actions */}
      <div className="flex flex-col gap-4 mb-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setFilterType("all")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filterType === "all"
                ? "bg-gray-900 text-white dark:bg-white dark:text-gray-900"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300"
            }`}
          >
            All
          </button>
          {roomTypes.map(type => (
            <button
              key={type.value}
              onClick={() => setFilterType(type.value)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filterType === type.value
                  ? "bg-gray-900 text-white dark:bg-white dark:text-gray-900"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300"
              }`}
            >
              {type.label}
            </button>
          ))}
        </div>
        <Button onClick={openCreatePanel} disabled={createRoom.isPending || updateRoom.isPending}>
          <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Room
        </Button>
      </div>

      {/* Empty State */}
      {rooms.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="h-16 w-16 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center mb-4">
            <svg className="h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            {filterType === "all" ? "No rooms yet" : `No ${filterType} rooms`}
          </h3>
          <p className="text-gray-500 dark:text-gray-400 mb-4">
            {filterType === "all" 
              ? "Create your first room to get started" 
              : "Try a different filter or add a new room"}
          </p>
          <Button onClick={openCreatePanel}>Add Your First Room</Button>
        </div>
      )}

      {/* Rooms Grid */}
      {rooms.length > 0 && (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {rooms.map((room: Room) => (
          <div
            key={room.id}
            className={`rounded-2xl border-2 bg-white p-5 dark:bg-gray-800 transition-all hover:shadow-lg ${
              room.status === "available"
                ? `${getColorClass(room.color, "border")} border-opacity-30 hover:border-opacity-100`
                : "border-gray-200 dark:border-gray-700 opacity-75"
            }`}
          >
            {/* Header */}
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className={`h-12 w-12 rounded-xl flex items-center justify-center text-white ${getColorClass(room.color, "bg")}`}>
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white">{room.name}</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {roomTypes.find(t => t.value === room.type)?.label}
                  </p>
                </div>
              </div>
              <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                room.status === "available"
                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                  : room.status === "maintenance"
                  ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                  : "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-400"
              }`}>
                {room.status}
              </span>
            </div>

            {/* Description */}
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 line-clamp-2">
              {room.description}
            </p>

            {/* Capacity */}
            <div className="flex items-center gap-2 mb-4">
              <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Capacity: {room.capacity} people
              </span>
            </div>

            {/* Amenities */}
            <div className="mb-4">
              <div className="flex flex-wrap gap-1">
                {room.amenities.slice(0, 4).map((amenity) => (
                  <span
                    key={amenity}
                    className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400"
                  >
                    {amenity}
                  </span>
                ))}
                {room.amenities.length > 4 && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400">
                    +{room.amenities.length - 4} more
                  </span>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-4 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => openEditPanel(room)}
                className="flex-1 px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
              >
                Edit
              </button>
              <button
                onClick={() => handleDelete(room.id)}
                disabled={deleteRoom.isPending}
                className="px-3 py-2 text-sm font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/30 disabled:opacity-50"
              >
                Delete
              </button>
            </div>
          </div>
        ))}

        {/* Add New Room Card */}
        <button
          onClick={openCreatePanel}
          className="rounded-2xl border-2 border-dashed border-gray-300 bg-gray-50 p-5 dark:border-gray-600 dark:bg-gray-800/50 flex flex-col items-center justify-center gap-3 min-h-[280px] hover:border-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/10 transition-colors"
        >
          <div className="h-12 w-12 rounded-xl bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
            <svg className="h-6 w-6 text-gray-500 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </div>
          <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Add New Room</span>
        </button>
      </div>
      )}

      {/* Slide Panel for Create/Edit */}
      <SlidePanel
        isOpen={showPanel}
        onClose={() => setShowPanel(false)}
        title={editingRoom ? "Edit Room" : "Add New Room"}
        size="lg"
      >
        <div className="space-y-6">
          {/* Room Name */}
          <div>
            <Label>Room Name</Label>
            <Input
              type="text"
              placeholder="e.g., Studio A"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
            />
          </div>

          {/* Room Type */}
          <div>
            <Label>Room Type</Label>
            <div className="grid grid-cols-2 gap-2 mt-2">
              {roomTypes.map((type) => (
                <button
                  key={type.value}
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, type: type.value as Room["type"] }))}
                  className={`p-3 rounded-lg text-sm font-medium border transition-colors ${
                    formData.type === type.value
                      ? "border-amber-500 bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400"
                      : "border-gray-200 text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                  }`}
                >
                  {type.label}
                </button>
              ))}
            </div>
          </div>

          {/* Capacity */}
          <div>
            <Label>Capacity (max people)</Label>
            <Input
              type="number"
              min="1"
              max="100"
              value={formData.capacity}
              onChange={(e) => setFormData(prev => ({ ...prev, capacity: parseInt(e.target.value) }))}
            />
          </div>

          {/* Status */}
          <div>
            <Label>Status</Label>
            <div className="flex gap-2 mt-2">
              {["available", "maintenance", "inactive"].map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, status: status as Room["status"] }))}
                  className={`flex-1 px-3 py-2.5 rounded-lg text-sm font-medium border transition-colors capitalize ${
                    formData.status === status
                      ? status === "available"
                        ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400"
                        : status === "maintenance"
                        ? "border-amber-500 bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400"
                        : "border-gray-500 bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-400"
                      : "border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-400"
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>

          {/* Color */}
          <div>
            <Label>Room Color (for calendar display)</Label>
            <div className="flex gap-3 mt-2">
              {colorOptions.map((color) => (
                <button
                  key={color.value}
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, color: color.value }))}
                  className={`h-10 w-10 rounded-full ${color.class} transition-all ${
                    formData.color === color.value
                      ? "ring-2 ring-offset-2 ring-gray-400 dark:ring-offset-gray-900 scale-110"
                      : "hover:scale-105"
                  }`}
                  title={color.label}
                />
              ))}
            </div>
          </div>

          {/* Description */}
          <div>
            <Label>Description</Label>
            <textarea
              className="w-full h-24 rounded-lg border border-gray-300 px-4 py-2.5 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white resize-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 outline-none transition-colors"
              placeholder="Brief description of the room and its features..."
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
            />
          </div>

          {/* Amenities */}
          <div>
            <Label>Amenities</Label>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">Select all amenities available in this room</p>
            <div className="flex flex-wrap gap-2">
              {amenityOptions.map((amenity) => (
                <button
                  key={amenity}
                  type="button"
                  onClick={() => toggleAmenity(amenity)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                    formData.amenities?.includes(amenity)
                      ? "border-amber-500 bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400"
                      : "border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-700"
                  }`}
                >
                  {formData.amenities?.includes(amenity) && (
                    <svg className="h-4 w-4 inline mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                  {amenity}
                </button>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-6 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={() => setShowPanel(false)}
              disabled={createRoom.isPending || updateRoom.isPending}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!formData.name || createRoom.isPending || updateRoom.isPending}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-amber-500 rounded-lg hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {createRoom.isPending || updateRoom.isPending ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Saving...
                </span>
              ) : editingRoom ? "Save Changes" : "Create Room"}
            </button>
          </div>
        </div>
      </SlidePanel>
    </div>
  );
}
